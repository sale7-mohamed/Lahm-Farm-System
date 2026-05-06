import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.user_type = self.scope.get("user_type")

        if not self.user.is_authenticated:
            await self.close()
            return

        #              ID
        prefix = "employee" if self.user_type == "employee" else "customer"
        self.group_name = f"{prefix}_notifications_{self.user.id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'general_notification',
            'payload': event["content"]
        }))

    async def new_chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_notification',
            'payload': event["content"]
        }))

    async def force_refresh_permissions(self, event):
        await self.send(text_data=json.dumps({
            'type': 'force_refresh_permissions',
            'payload': event.get("content", {})
        }))
