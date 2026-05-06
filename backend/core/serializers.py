# core/serializers.py
from rest_framework import serializers
from django.utils.translation import get_language
from .models import Country, Governorate

class CountrySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Country
        fields = ["id", "name", "name_ar", "name_en", "code", "currency", "is_default"]

    def get_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.name_en:
            return obj.name_en
        return obj.name_ar

class GovernorateSerializer(serializers.ModelSerializer):
    country = CountrySerializer(read_only=True)
    name = serializers.SerializerMethodField()

    class Meta:
        model = Governorate
        fields = ["id", "name", "name_ar", "name_en", "country"]

    def get_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.name_en:
            return obj.name_en
        return obj.name_ar

