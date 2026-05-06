# accounts/admin.py

from django.contrib import admin
#   :  UserAdmin 
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, OTP, Address
from django.contrib.auth.models import Group
from django import forms
from phonenumbers import parse as parse_phone, is_valid_number, format_number, PhoneNumberFormat

class UserAdminForm(forms.ModelForm):
    class Meta:
        model = User
        fields = '__all__'

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if not email:
            return None
        qs = User.objects.filter(email__iexact=email)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("User with this Email address already exists.")
        return email

    def clean_phone(self):
        phone = self.cleaned_data.get('phone')
        if phone:
            try:
                phone_number = parse_phone(phone, "EG")
                if not is_valid_number(phone_number):
                    raise forms.ValidationError("رقم الهاتف المدخل غير صحيح.")
                return format_number(phone_number, PhoneNumberFormat.E164)
            except Exception:
                raise forms.ValidationError("صيغة رقم الهاتف غير صحيحة.")
        return phone

#   :   BaseUserAdmin   ModelAdmin
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserAdminForm
    #  fieldsets  BaseUserAdmin    
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ('بيانات العميل', {"fields": ("full_name", "phone", "email", "address", "is_phone_verified", "is_email_verified", "employee_profile")}),
        ("Permissions", {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            ),
        }),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('بيانات العميل', {'fields': ('full_name', 'phone', 'email')}),
    )
    list_display = ('username', 'full_name', 'phone', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'groups')
    search_fields = ('username', 'full_name', 'phone', 'email')
    ordering = ('-id',)
    readonly_fields = ('last_login', 'date_joined')

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('user', 'governorate', 'city', 'street', 'is_default')
    list_filter = ('governorate', 'city', 'is_default')
    search_fields = ('user__full_name', 'user__phone', 'street', 'city')
    list_editable = ('is_default',)

@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'code', 'created_at', 'expires_at', 'is_used')
    list_filter = ('type', 'is_used', 'created_at')
    search_fields = ('user__phone', 'user__email')

admin.site.unregister(Group)
