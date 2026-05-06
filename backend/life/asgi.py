# life/asgi.py
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'life.settings')
django_asgi_app = get_asgi_application()

from django.urls import path
from channels.routing import ProtocolTypeRouter, URLRouter
from life.TokenAuthMiddleware import TokenAuthMiddleware
from notifications.consumers import NotificationConsumer
from management.consumers import ChatConsumer

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter([
            path("ws/notifications/", NotificationConsumer.as_asgi()),
            path("ws/chat/<int:room_id>/", ChatConsumer.as_asgi()),
        ])
    ),
})

