import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatMessage, ChatRoom, Employee
from django.utils.html import escape

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        self.user = self.scope['user']

        if not self.user.is_authenticated or not isinstance(self.user, Employee):
            await self.close()
            return

        if not await self.check_participation():
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        can_write = await self.check_write_permission()
        if not can_write:
            return

        if msg_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_typing',
                    'user_id': self.user.id
                }
            )
            return

        if msg_type == 'message':
            raw_content = data.get('content', '').strip()
            content = escape(raw_content)
            if not content:
                return

            message = await self.create_message(content)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': message.id,
                        'author': {
                            'id': message.author.id,
                            'full_name': message.author.full_name
                        },
                        'author_id': message.author.id,
                        'content': message.content,
                        'attachment': None,
                        'is_deleted': False,
                        'timestamp': message.timestamp.isoformat(),
                        'is_read': False
                    }
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    async def user_typing(self, event):
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id']
            }))

    async def message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id']
        }))

    async def message_reaction(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_reaction',
            'message_id': event['message_id'],
            'reactions': event['reactions']
        }))

    async def read_receipt_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'read_receipt_notification',
            'room_id': event['room_id'],
            'updated_message_ids': event['updated_message_ids']
        }))

    @database_sync_to_async
    def check_participation(self):
        if self.user.is_superuser:
            return True
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            return room.participants.filter(id=self.user.id).exists()
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def check_write_permission(self):
        if getattr(self.user, 'is_chat_blocked', False):
            return False
        if self.user.is_superuser:
            return True
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            if room.room_type == 'GROUP' and room.allowed_writers.exists():
                return room.allowed_writers.filter(id=self.user.id).exists()
            return True
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def create_message(self, content):
        return ChatMessage.objects.create(
            room_id=self.room_id,
            author=self.user,
            content=content
        )

