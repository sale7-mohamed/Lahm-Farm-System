# orders/admin.py
from django.contrib import admin
from .models import Order, OrderItem, SpecialRequest, Shipment
from notifications.utils import send_notification
import json

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('animal', 'price_per_item', 'deposit_per_item', 'get_services_display', 'get_total_price', 'get_total_deposit')
    fields = ('animal', 'price_per_item', 'deposit_per_item', 'get_services_display', 'get_total_price', 'get_total_deposit')

    def get_total_price(self, obj):
        return obj.get_total_price()
    get_total_price.short_description = "إجمالي السعر"

    def get_total_deposit(self, obj):
        return obj.get_total_deposit()
    get_total_deposit.short_description = "إجمالي الديبوزيت"

    def get_services_display(self, obj):
        services = obj.selected_services
        if not services or not isinstance(services, dict):
            return "لا يوجد"

        display_list = [key for key, value in services.items() if value]
        return ", ".join(display_list) if display_list else "لا يوجد"
    get_services_display.short_description = "الخدمات"

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'total_price', 'deposit_total', 'created_at', 'updated_at')
    list_filter = ('status', 'created_at')
    search_fields = ('id', 'user__username', 'user__email')
    inlines = [OrderItemInline]
    readonly_fields = ('total_price', 'deposit_total', 'created_at', 'updated_at')

    fieldsets = (
        ('معلومات الطلب', {
            'fields': ('user', 'status', 'total_price', 'deposit_total', 'notes', 'shipment')
        }),
        ('تواريخ', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def save_model(self, request, obj, form, change):
        old_status = None
        if obj.pk:
            try:
                old_status = Order.objects.get(pk=obj.pk).status
            except Order.DoesNotExist:
                pass

        super().save_model(request, obj, form, change)

        if change and 'status' in form.changed_data and obj.user and old_status != obj.status:
            status_display = obj.get_status_display()
            title = f"تحديث حالة طلبك رقم #{obj.id}"
            message = f"تم تحديث حالة طلبك رقم #{obj.id} : '{status_display}'."

            if obj.status == 'shipped':
                message = f"طلبك رقم #{obj.id}   !"
            elif obj.status == 'preparing':
                 message = f"طلبك رقم #{obj.id}   ."

            send_notification(
                user=obj.user,
                title=title,
                message=message,
                category="order"
            )

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'animal', 'price_per_item', 'deposit_per_item', 'get_total_price')
    list_filter = ('order__status',)
    search_fields = ('order__id', 'animal__code')

    def get_total_price(self, obj):
        return obj.get_total_price()
    get_total_price.short_description = "إجمالي السعر"

@admin.register(SpecialRequest)
class SpecialRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'created_at', 'sourced_animal')
    list_filter = ('status', 'created_at')
    search_fields = ('user__full_name', 'user__phone')
    list_select_related = ('user', 'sourced_animal')
    readonly_fields = ('created_at', 'updated_at', 'related_order')

@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'supervisor', 'driver_name', 'status', 'date')
    list_filter = ('status', 'date')