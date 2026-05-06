from django.contrib import admin
from .models import Reservation

@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('animal', 'user', 'status', 'reserved_at')
    list_filter = ('status',)
    search_fields = ('animal__code', 'user__username')


