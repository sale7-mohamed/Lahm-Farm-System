# partnerships/serializers.py
from rest_framework import serializers
from .models import PartnershipApplication

class PartnershipApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnershipApplication
        fields = '__all__'
        read_only_fields = ('status', 'admin_notes', 'created_at', 'updated_at')

class PartnershipManagementSerializer(serializers.ModelSerializer):

    class Meta:
        model = PartnershipApplication
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')
