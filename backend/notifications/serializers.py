from rest_framework import serializers
from .models import Notification
from django.utils import timezone

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'category', 'is_read', 'created_at']

    def get_created_at_formatted(self, obj):
        return timezone.localtime(obj.created_at).strftime('%Y-%m-%d %I:%M %p')



