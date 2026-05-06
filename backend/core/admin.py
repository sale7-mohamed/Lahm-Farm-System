# core/admin.py
from django.contrib import admin
from .models import Country, Governorate

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ar", "name_en", "code", "currency", "is_default")
    search_fields = ("name_ar", "name_en", "code")
    list_editable = ("currency", "is_default")

@admin.register(Governorate)
class GovernorateAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ar", "name_en", "country")
    search_fields = ("name_ar", "name_en")
    list_filter = ("country",)


