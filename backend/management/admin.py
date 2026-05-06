# management/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Permission
from .models import (
    Employee, FarmDepartment, EmployeeRole, RolePermission,
    Supplier, InventoryItem, StockMovement,
    FeedingRule, HealthLog, Payroll, FeedingLog, WeightLog,
    AttendanceLog
)
from livestock.models import Animal
from livestock.admin import AnimalAdmin as BaseAnimalAdmin

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'content_type', 'codename')
    search_fields = ('name', 'codename')
    list_filter = ('content_type',)

@admin.register(Employee)
class EmployeeAdmin(UserAdmin):
    list_display = ('username', 'full_name', 'phone', 'department', 'role', 'is_staff', 'is_active')
    search_fields = ('username', 'full_name', 'phone', 'employee_id')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'groups', 'department', 'role')
    ordering = ('-hire_date',)

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'phone', 'email', 'national_id', 'address')}),
        ('Work Info', {'fields': ('department', 'role', 'hire_date', 'base_salary')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone', 'full_name', 'national_id', 'password'),
        }),
    )
    readonly_fields = ('last_login', 'birth_date')

class WeightLogInline(admin.TabularInline):
    model = WeightLog
    extra = 1
    readonly_fields = ('recorded_by',)
    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if not instance.pk and isinstance(request.user, Employee):
                instance.recorded_by = request.user
            instance.save()
        formset.save_m2m()

if admin.site.is_registered(Animal):
    admin.site.unregister(Animal)

@admin.register(Animal)
class ExtendedAnimalAdmin(BaseAnimalAdmin):
    inlines = list(BaseAnimalAdmin.inlines) + [WeightLogInline]

@admin.register(FarmDepartment)
class FarmDepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'get_employee_count')
    def get_employee_count(self, obj):
        return obj.employee_set.count()
    get_employee_count.short_description = 'عدد الموظفين'

class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1
    autocomplete_fields = ['permission']

@admin.register(EmployeeRole)
class EmployeeRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'department')
    inlines = [RolePermissionInline]
    search_fields = ('name',)
    list_filter = ('department',)

@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'current_stock', 'unit_of_measure', 'min_stock_level', 'supplier')
    list_filter = ('type', 'supplier')
    search_fields = ('name',)

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('item', 'quantity', 'movement_type', 'timestamp', 'user')
    list_filter = ('movement_type',)
    raw_id_fields = ('user', 'item', 'lot')

@admin.register(HealthLog)
class HealthLogAdmin(admin.ModelAdmin):
    list_display = ('animal', 'log_date', 'log_type', 'vet')
    raw_id_fields = ('animal', 'vet')

@admin.register(FeedingLog)
class FeedingLogAdmin(admin.ModelAdmin):
    list_display = ('animal', 'item', 'quantity_kg', 'timestamp', 'user')
    raw_id_fields = ('animal', 'item', 'user')

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'address')
    search_fields = ('name', 'phone')
    filter_horizontal = ('items_supplied',)

@admin.register(AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = ('employee', 'date', 'status', 'check_in_time', 'check_out_time')
    list_filter = ('date', 'status')
    search_fields = ('employee__full_name',)

admin.site.register(FeedingRule)
admin.site.register(Payroll)
