import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time notifications."""

    async def connect(self):
        self.user = self.scope.get("user", AnonymousUser())
        
        if self.user.is_anonymous:
            await self.close(code=4001)
            return
        
        self.group_name = f"user_{self.user.id}_notifications"
        
        # Join user notification group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        
        await self.accept()
        
        # Send unread count on connect
        unread_count = await self.get_unread_count()
        await self.send_json({
            "type": "connection_established",
            "unread_count": unread_count,
        })
        
        logger.info(f"WebSocket connected for user {self.user.id}")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )
        logger.info(f"WebSocket disconnected for user {getattr(self, 'user', None)}")

    async def receive_json(self, content):
        """Handle client messages."""
        action = content.get("action")
        
        if action == "mark_read":
            notification_ids = content.get("ids", [])
            await self.mark_notifications_read(notification_ids)
            unread_count = await self.get_unread_count()
            await self.send_json({
                "type": "unread_count",
                "count": unread_count,
            })
        
        elif action == "ping":
            await self.send_json({"type": "pong"})

    async def notification_message(self, event):
        """Handle notification messages from channel layer."""
        await self.send_json({
            "type": "notification",
            "notification": event["notification"],
        })

    async def unread_count_update(self, event):
        """Handle unread count updates."""
        await self.send_json({
            "type": "unread_count",
            "count": event["count"],
        })

    @database_sync_to_async
    def get_unread_count(self):
        from .models import Notification
        return Notification.objects.filter(user=self.user, is_read=False).count()

    @database_sync_to_async
    def mark_notifications_read(self, notification_ids):
        from django.utils import timezone
        from .models import Notification
        
        if notification_ids:
            Notification.objects.filter(
                id__in=notification_ids,
                user=self.user,
                is_read=False,
            ).update(is_read=True, read_at=timezone.now())
        else:
            Notification.objects.filter(
                user=self.user,
                is_read=False,
            ).update(is_read=True, read_at=timezone.now())


class ConversationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time messaging."""

    async def connect(self):
        self.user = self.scope.get("user", AnonymousUser())
        self.conversation_id = self.scope["url_route"]["kwargs"].get("conversation_id")
        
        if self.user.is_anonymous:
            await self.close(code=4001)
            return
        
        # Verify user is part of conversation
        has_access = await self.check_conversation_access()
        if not has_access:
            await self.close(code=4003)
            return
        
        self.group_name = f"conversation_{self.conversation_id}"
        
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        
        await self.accept()
        logger.info(f"User {self.user.id} joined conversation {self.conversation_id}")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def receive_json(self, content):
        """Handle incoming messages."""
        action = content.get("action")
        
        if action == "typing":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "typing_indicator",
                    "user_id": str(self.user.id),
                    "username": self.user.username,
                }
            )
        
        elif action == "message_read":
            message_id = content.get("message_id")
            await self.mark_message_read(message_id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "message_read_receipt",
                    "message_id": message_id,
                    "user_id": str(self.user.id),
                }
            )

    async def chat_message(self, event):
        """Broadcast new message to conversation participants."""
        await self.send_json({
            "type": "new_message",
            "message": event["message"],
        })

    async def typing_indicator(self, event):
        """Forward typing indicator."""
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "typing",
                "user_id": event["user_id"],
                "username": event["username"],
            })

    async def message_read_receipt(self, event):
        """Forward read receipt."""
        await self.send_json({
            "type": "read_receipt",
            "message_id": event["message_id"],
            "user_id": event["user_id"],
        })

    @database_sync_to_async
    def check_conversation_access(self):
        from messaging.models import Conversation
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            return conversation.user_a == self.user or conversation.user_b == self.user
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def mark_message_read(self, message_id):
        from django.utils import timezone
        from messaging.models import ConversationMessage
        try:
            msg = ConversationMessage.objects.get(
                id=message_id,
                conversation_id=self.conversation_id,
            )
            if msg.sender != self.user and not msg.read_at:
                msg.read_at = timezone.now()
                msg.save(update_fields=["read_at"])
        except ConversationMessage.DoesNotExist:
            pass
