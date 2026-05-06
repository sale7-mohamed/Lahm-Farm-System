# notifications/routing.py
from django.urls import path
from . import consumers

#   :      asgi.py
websocket_urlpatterns = [
    path('notifications/', consumers.NotificationConsumer.as_asgi()),
]
