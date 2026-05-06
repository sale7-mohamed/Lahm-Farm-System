# livestock/admin.py

from django.contrib import admin
from .models import Animal, Category, AnimalImage, DeliverySetting, DeliveryArea, ClientServiceQuestion, ClientServiceOption, ServicePriceSetting
from django import forms
from django.utils.translation import gettext_lazy as _
from notifications.utils import send_notification, send_admin_notification
from datetime import date
from dateutil.relativedelta import relativedelta

# ---- Inline for animal images ----
class AnimalImageInline(admin.TabularInline):
    model = AnimalImage
    extra = 1

class ClientServiceOptionInline(admin.TabularInline):
    model = ClientServiceOption
    extra = 1

# --- Custom form to handle age input ---
class AnimalAdminForm(forms.ModelForm):
    age_in_months_input = forms.IntegerField(
        label=_('العمر (بالأشهر)'),
        help_text=_('إذا أدخلت العمر هنا، سيتم حساب تاريخ الميلاد تلقائياً عند الحفظ (إذا كان حقل تاريخ الميلاد فارغاً).'),
        required=False
    )

    class Meta:
        model = Animal
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.birth_date:
            self.fields['age_in_months_input'].initial = self.instance.age_months

    def clean(self):
        cleaned_data = super().clean()
        birth_date = cleaned_data.get('birth_date')
        age_in_months = cleaned_data.get('age_in_months_input')

        if not self.instance.pk and not birth_date and not age_in_months:
            raise forms.ValidationError(
                _("عند إضافة حيوان جديد، يجب إدخال تاريخ الميلاد أو العمر بالأشهر.")
            )
        return cleaned_data

# ---- Animal admin ----
@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    form = AnimalAdminForm
    list_display = (
        "code",
        "name",
        "get_category",
        "sex",
        "birth_date",
        "get_age_months",
        "current_weight",
        "price_egp",
        "status",
        "is_shareable", #    ( is_sharable)

    )
    list_filter = (
        "category",
        "sex",
        "status",
        "is_offer",
        "is_shareable",
    )
    search_fields = ("name", "code")

    list_editable = ("status", "is_shareable")

    inlines = [AnimalImageInline]
    readonly_fields = ()

    fieldsets = (
        (None, {
            'fields': ('code', 'name', 'category', 'sex', 'birth_date', 'age_in_months_input', 'breed')
        }),
        ('السعر', {
            'fields': ('price_egp', 'deposit_egp', 'purchase_price')
        }),
        ('المشاركة (الأسهم)', {
            'fields': ()
        }),
        ('المصدر والملاحظات', {
            'fields': ('entry_type', 'source_farm', 'supplier_code', 'internal_notes')
        }),
        ('العروض والحالة', {
            'fields': ('discount_percent', 'is_offer', 'status', 'description', 'image')
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['birth_date'].required = False
        return form

    @admin.display(ordering='category__name_ar', description='الفئة')
    def get_category(self, obj):
        return obj.category.name_ar

    @admin.display(description='العمر (بالأشهر)')
    def get_age_months(self, obj):
        return obj.age_months

    def save_model(self, request, obj, form, change):
        age_months_input = form.cleaned_data.get('age_in_months_input')
        if age_months_input and not obj.birth_date:
            obj.birth_date = date.today() - relativedelta(months=int(age_months_input))

        is_new = not obj.pk
        super().save_model(request, obj, form, change)

        if is_new and obj.is_offer:
            title = "أضفنا منتج جديد بعرض مميز!"
            message = f"تمت إضافة الحيوان {obj.code} ({obj.category.name_ar}) بسعر خاص. لا تفوت الفرصة!"
            send_admin_notification(title=title, message=message, category="livestock")

# ---- Category admin ----
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "name_en", "slug", "standard_birth_cost", "daily_care_fee", "default_max_shares")
    list_editable = ("standard_birth_cost", "daily_care_fee", "default_max_shares")
    search_fields = ("name_ar", "name_en")

# ---- AnimalImage admin ----
@admin.register(AnimalImage)
class AnimalImageAdmin(admin.ModelAdmin):
    list_display = ("animal", "image")
    list_filter = ("animal",)

# ==========================
# DeliverySetting admin with proper day selection
# ==========================

DAYS_OF_WEEK = [
    ("Saturday", _("Saturday")),
    ("Sunday", _("Sunday")),
    ("Monday", _("Monday")),
    ("Tuesday", _("Tuesday")),
    ("Wednesday", _("Wednesday")),
    ("Thursday", _("Thursday")),
    ("Friday", _("Friday")),
]

class DeliverySettingForm(forms.ModelForm):
    delivery_days = forms.MultipleChoiceField(
        choices=DAYS_OF_WEEK,
        widget=forms.CheckboxSelectMultiple,
        label="أيام التوصيل",
        required=False
    )
    pickup_days = forms.MultipleChoiceField(
        choices=DAYS_OF_WEEK,
        widget=forms.CheckboxSelectMultiple,
        label="أيام الاستلام من المزرعة",
        required=False
    )

    class Meta:
        model = DeliverySetting
        fields = "__all__"

    def clean_delivery_days(self):
        return self.cleaned_data["delivery_days"]

    def clean_pickup_days(self):
        return self.cleaned_data["pickup_days"]

@admin.register(DeliverySetting)
class DeliverySettingAdmin(admin.ModelAdmin):
    form = DeliverySettingForm
    list_display = (
        "id",
        "delivery_days_display",
        "pickup_days_display",
        "preparation_days",
        "free_care_days",
        "min_deposit_percentage",
        "service_deposit_percentage",
    )
    fieldsets = (
        (None, {
            "fields": (
                "delivery_days",
                "pickup_days",
                "preparation_days",
                "free_care_days",
                "min_deposit_percentage",
                "service_deposit_percentage",
            )
        }),
    )

    def delivery_days_display(self, obj):
        return ", ".join(obj.delivery_days)
    delivery_days_display.short_description = "أيام التوصيل"

    def pickup_days_display(self, obj):
        return ", ".join(obj.pickup_days)
    pickup_days_display.short_description = "أيام الاستلام"

@admin.register(DeliveryArea)
class DeliveryAreaAdmin(admin.ModelAdmin):
    list_display = ("governorate", "delivery_price", "is_active")
    list_filter = ("is_active",)
    search_fields = ("governorate__name_ar", "governorate__name_en")

@admin.register(ClientServiceQuestion)
class ClientServiceQuestionAdmin(admin.ModelAdmin):
    list_display = ('question_text', 'is_active', 'show_to_client')
    inlines = [ClientServiceOptionInline]

@admin.register(ClientServiceOption)
class ClientServiceOptionAdmin(admin.ModelAdmin):
    list_display = ('option_text', 'question', 'price', 'is_active')

@admin.register(ServicePriceSetting)
class ServicePriceSettingAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "is_active")
    list_editable = ("price", "is_active")
    search_fields = ("name",)
