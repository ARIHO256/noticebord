from django.db import models
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Conversation
from .serializers import (
    ConversationCreateSerializer,
    ConversationMessageSerializer,
    ConversationSerializer,
    MessageCreateSerializer,
)
from users.throttling import MessageRateThrottle


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Conversation.objects.all()

    def get_queryset(self):
        user = self.request.user
        return (
            Conversation.objects.filter(models.Q(user_a=user) | models.Q(user_b=user))
            .select_related("user_a", "user_b", "notice", "last_message_by")
            .order_by("-last_message_at", "-updated_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ConversationCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        conversation, created = serializer.save_with_status()
        output = ConversationSerializer(conversation, context=self.get_serializer_context())
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status_code, headers=headers)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="messages", throttle_classes=[MessageRateThrottle])
    def messages(self, request, pk=None):
        from moderation.views import check_text_content
        import logging
        
        logger = logging.getLogger(__name__)
        conversation = self.get_object()
        
        if request.method.lower() == "get":
            messages_qs = conversation.messages.select_related("sender", "reply_to", "reply_to__sender").order_by("-created_at")
            unread_qs = messages_qs.filter(read_at__isnull=True).exclude(sender=request.user)
            unread_qs.update(read_at=timezone.now())
            page = self.paginate_queryset(messages_qs)
            if page is not None:
                serializer = ConversationMessageSerializer(page, many=True, context=self.get_serializer_context())
                return self.get_paginated_response(serializer.data)
            serializer = ConversationMessageSerializer(messages_qs, many=True, context=self.get_serializer_context())
            return Response(serializer.data)
        
        # POST request - validate message text before saving
        message_text = request.data.get('text', '')
        
        # Check message text for violations
        text_result = check_text_content(message_text)
        
        if not text_result['is_safe']:
            logger.warning(f"Message rejected by moderation from user {request.user.id}: {text_result['reason']}")
            return Response(
                {"detail": f"Message violates community guidelines: {text_result['reason']}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = MessageCreateSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "conversation": conversation},
        )
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        output = ConversationMessageSerializer(message, context=self.get_serializer_context())
        
        # Broadcast via WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"conversation_{conversation.id}",
                {
                    "type": "chat_message",
                    "message": output.data,
                }
            )
        
        # Create notification for recipient
        from notifications.signals import create_notification
        recipient = conversation.user_b if conversation.user_a == request.user else conversation.user_a
        create_notification(
            user=recipient,
            notification_type="message",
            title=f"New message from {request.user.get_full_name() or request.user.username}",
            message=message.content[:200] if message.content else "Attachment",
            sender=request.user,
            data={
                "conversation_id": str(conversation.id),
                "message_id": str(message.id),
            },
        )
        
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mark-as-read")
    def mark_as_read(self, request, pk=None):
        """Mark all unread messages in a conversation as read."""
        conversation = self.get_object()
        unread = conversation.messages.filter(
            read_at__isnull=True
        ).exclude(sender=request.user)
        count = unread.count()
        unread.update(read_at=timezone.now())
        return Response({"status": "marked_as_read", "count": count})
