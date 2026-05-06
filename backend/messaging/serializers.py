# messaging/serializers.py
from rest_framework import serializers
from .models import MessageLog, MessageTemplate
from django.utils import timezone

class MessageLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.full_name', read_only=True)
    created_at_formatted = serializers.SerializerMethodField()

    class Meta:
        model = MessageLog
        fields = '__all__'

    def get_created_at_formatted(self, obj):
        return timezone.localtime(obj.created_at).strftime('%Y-%m-%d %I:%M %p')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.message_type == 'OTP' or (instance.message_type == 'EMAIL' and 'كود التحقق' in instance.content):
            data['content'] = "كود تحقق (OTP) - [مخفي للأمان 🔒]"
        return data

class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = '__all__'

class SendBulkSerializer(serializers.Serializer):
    phones = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    message = serializers.CharField(min_length=5)

