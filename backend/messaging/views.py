from django.db import models
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Conversation, ConversationMessage, MessageReaction, ConversationMute
from .serializers import (
    ConversationSerializer,
    ConversationMessageSerializer,
    MessageReactionSerializer,
    ConversationMuteSerializer,
)


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            models.Q(user_a=user) | models.Q(user_b=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["get"], url_path="messages")
    def messages(self, request, pk=None):
        conversation = self.get_object()
        # Mark unread messages as read
        conversation.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
        qs = conversation.messages.all()
        page = self.paginate_queryset(qs)
        serializer = ConversationMessageSerializer(page or qs, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data) if page else Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="messages")
    def send_message(self, request, pk=None):
        conversation = self.get_object()
        serializer = ConversationMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        msg = serializer.save(conversation=conversation, sender=request.user)
        # Update conversation preview
        conversation.last_message_preview = msg.content[:100] if msg.content else (msg.attachment_name or "Attachment")
        conversation.last_message_by = request.user
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=["last_message_preview", "last_message_by", "last_message_at"])
        return Response(ConversationMessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mark-as-read")
    def mark_as_read(self, request, pk=None):
        conversation = self.get_object()
        conversation.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
        return Response({"detail": "Marked as read."})

    @action(detail=True, methods=["post"], url_path="mute")
    def mute(self, request, pk=None):
        conversation = self.get_object()
        muted_until = request.data.get("muted_until")
        mute, _ = ConversationMute.objects.update_or_create(
            conversation=conversation,
            user=request.user,
            defaults={"muted_until": muted_until},
        )
        return Response(ConversationMuteSerializer(mute).data)

    @action(detail=True, methods=["post"], url_path="unmute")
    def unmute(self, request, pk=None):
        conversation = self.get_object()
        ConversationMute.objects.filter(conversation=conversation, user=request.user).delete()
        return Response({"detail": "Unmuted."})


class ConversationMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ConversationMessage.objects.filter(
            conversation__models=Q(user_a=self.request.user) | Q(user_b=self.request.user)
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.mark_edited()

    @action(detail=True, methods=["post"], url_path="react")
    def react(self, request, pk=None):
        msg = self.get_object()
        reaction = request.data.get("reaction", "like")
        MessageReaction.objects.update_or_create(
            message=msg, user=request.user, defaults={"reaction": reaction}
        )
        return Response({"detail": "Reaction added."})

    @action(detail=True, methods=["post"], url_path="unreact")
    def unreact(self, request, pk=None):
        msg = self.get_object()
        MessageReaction.objects.filter(message=msg, user=request.user).delete()
        return Response({"detail": "Reaction removed."})

    @action(detail=True, methods=["post"], url_path="forward")
    def forward(self, request, pk=None):
        msg = self.get_object()
        conversation_id = request.data.get("conversation_id")
        conversation = Conversation.objects.get(pk=conversation_id)
        new_msg = ConversationMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            content=msg.content,
            attachment=msg.attachment,
            attachment_type=msg.attachment_type,
            attachment_name=msg.attachment_name,
            attachment_size=msg.attachment_size,
            media_url=msg.media_url,
            media_duration=msg.media_duration,
            is_forwarded=True,
            forwarded_from=msg,
        )
        return Response(ConversationMessageSerializer(new_msg, context={"request": request}).data, status=status.HTTP_201_CREATED)
