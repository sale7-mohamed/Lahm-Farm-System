# management/routing.py
from django.urls import path
from . import consumers

#   :      asgi.py
websocket_urlpatterns = [
    path('chat/<int:room_id>/', consumers.ChatConsumer.as_asgi()),
]
