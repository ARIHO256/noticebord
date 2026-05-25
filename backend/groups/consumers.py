import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


class GroupChatConsumer(AsyncWebsocketConsumer):
    """Real-time WebSocket consumer for group chat messages."""

    async def connect(self):
        self.group_id = self.scope["url_route"]["kwargs"]["group_id"]
        self.room_group_name = f"group_{self.group_id}"
        self.user = self.scope["user"]

        if self.user.is_anonymous:
            await self.close()
            return

        # Check membership
        is_member = await self.check_membership(self.group_id, self.user.id)
        if not is_member:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type", "message")

        if message_type == "message":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": data.get("message", ""),
                    "sender_id": self.user.id,
                    "sender_name": self.user.get_full_name() or self.user.username,
                    "attachment_url": data.get("attachment_url"),
                    "attachment_type": data.get("attachment_type"),
                },
            )
        elif message_type == "typing":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "user_typing",
                    "sender_id": self.user.id,
                    "sender_name": self.user.get_full_name() or self.user.username,
                },
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
            "sender_id": event["sender_id"],
            "sender_name": event["sender_name"],
            "attachment_url": event.get("attachment_url"),
            "attachment_type": event.get("attachment_type"),
        }))

    async def user_typing(self, event):
        await self.send(text_data=json.dumps({
            "type": "typing",
            "sender_id": event["sender_id"],
            "sender_name": event["sender_name"],
        }))

    @database_sync_to_async
    def check_membership(self, group_id, user_id):
        from .models import GroupMembership
        return GroupMembership.objects.filter(
            group_id=group_id, user_id=user_id, is_active=True
        ).exists()
