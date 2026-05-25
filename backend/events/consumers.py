import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class EventLiveConsumer(AsyncWebsocketConsumer):
    """Real-time WebSocket consumer for live event updates (RSVPs, check-ins, announcements)."""

    async def connect(self):
        self.event_id = self.scope["url_route"]["kwargs"]["event_id"]
        self.room_group_name = f"event_{self.event_id}"
        self.user = self.scope["user"]

        if self.user.is_anonymous:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send current attendee count
        count = await self.get_attendee_count(self.event_id)
        await self.send(text_data=json.dumps({
            "type": "attendee_count",
            "count": count,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type")

        if message_type == "rsvp_update":
            count = await self.get_attendee_count(self.event_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "attendee_count_update",
                    "count": count,
                },
            )

    async def attendee_count_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "attendee_count",
            "count": event["count"],
        }))

    async def event_announcement(self, event):
        await self.send(text_data=json.dumps({
            "type": "announcement",
            "title": event["title"],
            "message": event["message"],
            "sent_by": event["sent_by"],
        }))

    @database_sync_to_async
    def get_attendee_count(self, event_id):
        from .models import RSVP
        return RSVP.objects.filter(event_id=event_id, status=RSVP.STATUS_GOING).count()
