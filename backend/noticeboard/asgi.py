import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "noticeboard.settings")

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

from django.urls import path
from notifications.consumers import NotificationConsumer
from messaging.consumers import ConversationConsumer
from groups.consumers import GroupChatConsumer
from events.consumers import EventLiveConsumer

websocket_urlpatterns = [
    path("ws/notifications/", NotificationConsumer.as_asgi()),
    path("ws/conversations/<int:conversation_id>/", ConversationConsumer.as_asgi()),
    path("ws/groups/<int:group_id>/", GroupChatConsumer.as_asgi()),
    path("ws/events/<int:event_id>/", EventLiveConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
