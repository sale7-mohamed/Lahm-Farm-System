from rest_framework import serializers
from django.utils.translation import get_language
from decimal import Decimal
from .models import (
    Category,
    Animal,
    AnimalImage,
    ClientServiceQuestion,
    ClientServiceOption,
    DeliverySetting,
    DeliveryArea,
    ServicePriceSetting,
    CategoryGrowthRate,
    AdahiGroup,
    AnimalListing
)
from management.models import Supplier
from core.models import OperationSettings

class AnimalImageSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    is_video = serializers.ReadOnlyField()

    class Meta:
        model = AnimalImage
        fields = ['id', 'file', 'is_video', 'order']

    def get_file(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

class CategoryGrowthRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryGrowthRate
        fields = ['id', 'min_weight', 'max_weight', 'daily_increase']

class CategorySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)
    growth_rates = CategoryGrowthRateSerializer(many=True, read_only=True)
    logic_type = serializers.ChoiceField(choices=Category.LogicType.choices, required=False)

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'name_ar', 'name_en', 'slug',
            'standard_birth_cost', 'daily_care_fee',
            'default_max_shares', 'weight_variance_limit',
            'logic_type', 'growth_rates', 'image',
            'extra_delivery_fee', 'daily_delivery_limit',
            'allow_deposit', 'min_deposit_percentage', 'service_deposit_percentage',
            'enable_slaughter', 'slaughter_price', 'enable_cutting', 'cutting_price', 'enable_packaging', 'packaging_price',
            'free_care_days'
        ]

    def get_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.name_en:
            return obj.name_en
        return obj.name_ar

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        if instance.image and request:
            representation['image'] = request.build_absolute_uri(instance.image.url)
        return representation

class DeliverySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverySetting
        fields = '__all__'

class SupplierSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name']

class PipelineListingSerializer(serializers.ModelSerializer):
    animal_details = serializers.SerializerMethodField()
    sku = serializers.ReadOnlyField()
    price_per_share = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    pipeline_display = serializers.CharField(source='get_pipeline_display', read_only=True)
    section_display = serializers.CharField(source='get_section_display', read_only=True)
    is_group_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = AnimalListing
        fields = [
            'id', 'sku', 'pipeline', 'pipeline_display', 'section', 'section_display',
            'price', 'price_per_share',
            'total_shares', 'available_shares', 'is_active',
            'animal_details', 'group_code', 'group_expires_at', 'is_group_active'
        ]

    def get_animal_details(self, obj):
        animal = obj.animal
        request = self.context.get('request')

        source_farm_data = None
        if animal.source_farm:
            source_farm_data = {
                'id': animal.source_farm.id,
                'name': animal.source_farm.name
            }

        lang = get_language()
        cat_name = ''
        if animal.category:
            cat_name = animal.category.name_en if (lang == 'en' and animal.category.name_en) else animal.category.name_ar
        from .serializers import CategorySerializer
        category_data = CategorySerializer(animal.category, context={'request': request}).data if animal.category else None

        return {
            'id': animal.id,
            'unique_id': str(animal.unique_id),
            'code': animal.code,
            'category_name': cat_name,
            'category': category_data,
            'sex': animal.sex,
            'age_months': animal.age_months,
            'current_weight': animal.current_weight,
            'price_egp': animal.price_egp,
            'deposit_egp': animal.deposit_egp,
            'price_after_discount': animal.price_after_discount,
            'image': request.build_absolute_uri(animal.image.url) if animal.image and request else None,
            'images': AnimalImageSerializer(animal.images.all(), many=True, context=self.context).data,
            'has_discount': animal.has_discount,
            'discount_percent': animal.discount_percent,
            'is_offer': animal.is_offer,
            'description': animal.description,
            'breed': animal.breed,
            'location': animal.location,
            'has_defect': animal.has_defect,
            'entry_type': animal.entry_type,
            'status': animal.status,
            'is_shareable': animal.is_shareable,
            'is_sacrifice_valid_now': animal.is_sacrifice_valid_now,
            'eid_prediction': animal.get_eid_prediction(),
            'has_partial_sales': animal.orderitem_set.filter(
                order__status__in=['confirmed', 'processing', 'ready_for_shipment', 'delivered', 'completed']
            ).exists(),
            'source_farm': source_farm_data,
            'supplier_code': animal.supplier_code,
            'extra_delivery_fee': animal.category.extra_delivery_fee if animal.category else 0,
            'default_max_shares': animal.category.default_max_shares if animal.category else 1
        }

class AdahiGroupSerializer(serializers.ModelSerializer):
    animal_details = serializers.SerializerMethodField()
    listing_details = PipelineListingSerializer(source='listing', read_only=True)
    creator_name = serializers.CharField(source='created_by.full_name', read_only=True)
    creator_phone = serializers.CharField(source='created_by.phone', read_only=True)
    sold_shares = serializers.SerializerMethodField()

    class Meta:
        model = AdahiGroup
        fields = [
            'id', 'code', 'listing', 'listing_details', 'animal_details',
            'created_at', 'creator_name', 'creator_phone', 'is_active', 'expires_at',
            'sold_shares'
        ]
        read_only_fields = ['code', 'created_at']

    def get_sold_shares(self, obj):
        from orders.models import OrderItem
        from django.db import models
        sold = OrderItem.objects.filter(
            animal=obj.listing.animal,
            listing_section='adahi_group',
            order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed']
        ).aggregate(total=models.Sum('share_quantity'))['total']
        return sold or 0

    def get_animal_details(self, obj):
        animal = obj.listing.animal
        request = self.context.get('request')

        lang = get_language()
        cat_name = ''
        if animal.category:
            cat_name = animal.category.name_en if (lang == 'en' and animal.category.name_en) else animal.category.name_ar

        return {
            'id': animal.id,
            'unique_id': str(animal.unique_id),
            'code': animal.code,
            'category_name': cat_name,
            'sex': animal.sex,
            'age_months': animal.age_months,
            'current_weight': animal.current_weight,
            'price_egp': animal.price_egp,
            'price_after_discount': animal.price_after_discount,
            'image': request.build_absolute_uri(animal.image.url) if animal.image and request else None,
            'has_discount': animal.has_discount,
            'discount_percent': animal.discount_percent,
            'is_offer': animal.is_offer,
            'description': animal.description,
            'breed': animal.breed,
            'location': animal.location,
            'has_defect': animal.has_defect,
            'entry_type': animal.entry_type,
            'status': animal.status
        }

class AnimalSerializer(serializers.ModelSerializer):
    images = AnimalImageSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    mother = serializers.PrimaryKeyRelatedField(queryset=Animal.objects.filter(sex='female'), required=False, allow_null=True)
    father = serializers.PrimaryKeyRelatedField(queryset=Animal.objects.filter(sex='male'), required=False, allow_null=True)
    mother_code = serializers.CharField(source='mother.code', read_only=True, default=None)
    father_code = serializers.CharField(source='father.code', read_only=True, default=None)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True
    )
    source_farm_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        source='source_farm',
        write_only=True,
        required=False,
        allow_null=True
    )
    code = serializers.CharField(read_only=True)
    age_months = serializers.IntegerField(read_only=True)
    current_weight = serializers.DecimalField(
        source='annotated_current_weight',
        max_digits=6,
        decimal_places=2,
        read_only=True,
        allow_null=True
    )
    last_weight_date = serializers.DateField(
        source='annotated_last_weight_date',
        read_only=True,
        allow_null=True
    )
    has_discount = serializers.ReadOnlyField()
    price_after_discount = serializers.DecimalField(
        source='annotated_price_after_discount',
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    category_name = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)
    qr_code_image = serializers.ImageField(read_only=True)
    source_farm = SupplierSimpleSerializer(read_only=True)
    is_sacrifice_valid_now = serializers.BooleanField(read_only=True)
    eid_prediction = serializers.SerializerMethodField()
    sold_order_id = serializers.SerializerMethodField()
    sold_date = serializers.SerializerMethodField()
    sold_customer_name = serializers.SerializerMethodField()
    detailed_display_status = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    listings = serializers.SerializerMethodField()
    available_pipelines = serializers.SerializerMethodField()
    remaining_shares = serializers.SerializerMethodField()
    total_listed_shares = serializers.SerializerMethodField()
    has_partial_sales = serializers.SerializerMethodField()

    internal_image = serializers.ImageField(read_only=True)

    class Meta:
        model = Animal
        fields = [
            'id', 'unique_id', 'code', 'name', 'category', 'category_name', 'category_id',
            'sex', 'age_months', 'birth_date', 'breed', 'current_weight', 'last_weight_date',
            'price_egp', 'purchase_price', 'price_after_discount', 'deposit_egp',
            'discount_percent', 'is_offer', 'has_discount', 'status', 'status_display', 'description',
            'image', 'video', 'images', 'created_at', 'updated_at', 'qr_code_image',
            'source_farm', 'source_farm_id', 'supplier_code', 'internal_notes', 'location',
            'is_hidden_from_store', 'has_defect', 'is_sacrifice_valid_now', 'eid_prediction',
            'sold_order_id', 'sold_date', 'sold_customer_name', 'detailed_display_status',
            'listings', 'available_pipelines', 'remaining_shares', 'total_listed_shares',
            'has_partial_sales', 'internal_image', 'mother', 'father', 'mother_code', 'father_code',
            'entry_type'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_has_partial_sales(self, obj):
        return obj.has_partial_sales()

    def get_category_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.category.name_en:
            return obj.category.name_en
        return obj.category.name_ar

    def get_listings(self, obj):
        listings = obj.listings.filter(is_active=True)
        return PipelineListingSerializer(listings, many=True, context=self.context).data

    def get_available_pipelines(self, obj):
        return obj.operates_in_pipelines

    def get_remaining_shares(self, obj):
        return obj.remaining_shares

    def get_total_listed_shares(self, obj):
        return obj.total_listed_shares

    def get_eid_prediction(self, obj):
        try:
            return obj.get_eid_prediction()
        except Exception:
            return {
                'error': 'Unable to get prediction',
                'predicted_weight': None,
                'days_to_eid': None,
                'is_valid': False
            }

    def get_sold_order_id(self, obj):
        if obj.status == 'sold':
            item = obj.orderitem_set.filter(
                order__status__in=[
                    'pending', 'confirmed', 'processing',
                    'ready_for_shipment', 'out_for_delivery',
                    'delivered', 'completed'
                ]
            ).first()
            if item:
                return item.order.id
        return None

    def get_sold_date(self, obj):
        if obj.status == 'sold':
            item = obj.orderitem_set.filter(
                order__status__in=[
                    'pending', 'confirmed', 'processing',
                    'ready_for_shipment', 'out_for_delivery',
                    'delivered', 'completed'
                ]
            ).first()
            if item:
                return item.order.created_at
        return None

    def get_sold_customer_name(self, obj):
        if obj.status == 'sold':
            item = obj.orderitem_set.filter(
                order__status__in=[
                    'pending', 'confirmed', 'processing',
                    'ready_for_shipment', 'out_for_delivery',
                    'delivered', 'completed'
                ]
            ).first()
            if item and item.order.user:
                return item.order.user.full_name or item.order.user.phone
        return None

    def validate(self, data):
        if self.instance and hasattr(self.instance, 'annotated_current_weight'):
            current_weight = self.instance.annotated_current_weight
            if current_weight and current_weight <= 0:
                raise serializers.ValidationError({
                    'current_weight': 'الوزن الحالي يجب أن يكون أكبر من صفر'
                })
        return data

class AnimalCreateSerializer(AnimalSerializer):
    initial_weight_kg = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        write_only=True,
        required=True,
        min_value=Decimal("0.1")
    )
    initial_weight_date = serializers.DateField(
        write_only=True,
        required=False,
        allow_null=True
    )
    images = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )
    video = serializers.FileField(
        required=False,
        allow_null=True,
        write_only=True
    )
    internal_image = serializers.ImageField(required=False, allow_null=True, write_only=True)

    class Meta(AnimalSerializer.Meta):
        fields = AnimalSerializer.Meta.fields + [
            'initial_weight_kg', 'initial_weight_date', 'images', 'video', 'internal_image'
        ]

class CategoryHomeSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'slug', 'name_ar', 'name_en', 'name', 'image']

    def get_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.name_en:
            return obj.name_en
        return obj.name_ar

    def get_image(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url') and request:
            return request.build_absolute_uri(obj.image.url)
        return None

class AnimalHomeSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    category = CategoryHomeSerializer(read_only=True)
    has_discount = serializers.ReadOnlyField()
    price_after_discount = serializers.DecimalField(
        source='annotated_price_after_discount',
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    age_months = serializers.IntegerField(read_only=True)
    current_weight = serializers.DecimalField(
        source='annotated_current_weight',
        max_digits=6,
        decimal_places=2,
        read_only=True,
        allow_null=True
    )
    source_farm = SupplierSimpleSerializer(read_only=True)
    remaining_shares = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    eid_prediction = serializers.SerializerMethodField()

    listings = serializers.SerializerMethodField()
    available_pipelines = serializers.SerializerMethodField()
    total_listed_shares = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = [
            'id', 'unique_id', 'code', 'category', 'category_name', 'sex',
            'age_months', 'current_weight', 'price_egp', 'price_after_discount',
            'discount_percent', 'is_offer', 'has_discount', 'status', 'image',
            'source_farm', 'remaining_shares', 'eid_prediction',
            'listings', 'available_pipelines', 'total_listed_shares'
        ]

    def get_image(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url') and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_category_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.category.name_en:
            return obj.category.name_en
        return obj.category.name_ar

    def get_listings(self, obj):
        listings = obj.listings.filter(is_active=True)
        return PipelineListingSerializer(listings, many=True, context=self.context).data

    def get_available_pipelines(self, obj):
        return obj.operates_in_pipelines

    def get_remaining_shares(self, obj):
        return obj.remaining_shares

    def get_total_listed_shares(self, obj):
        return obj.total_listed_shares

    def get_eid_prediction(self, obj):
        if obj.status != 'available':
            return None
        try:
            prediction = obj.get_eid_prediction()
            if prediction:
                return {
                    'predicted_weight': round(prediction['predicted_weight'], 2) if prediction['predicted_weight'] else 0,
                    'daily_increase': prediction.get('daily_increase', 0),
                    'days_to_eid': prediction.get('days_remaining', 0),
                    'is_valid': prediction.get('is_valid', False),
                    'age_at_eid': prediction.get('age_at_eid', 0)
                }
        except Exception:
            pass
        return None

class DeliveryAreaSerializer(serializers.ModelSerializer):
    governorate_name = serializers.SerializerMethodField()
    governorate_name_ar = serializers.CharField(source='governorate.name_ar', read_only=True)

    class Meta:
        model = DeliveryArea
        fields = ['id', 'governorate', 'governorate_name', 'governorate_name_ar', 'delivery_price', 'is_active']

    def get_governorate_name(self, obj):
        lang = get_language()
        if lang == 'en' and obj.governorate.name_en:
            return obj.governorate.name_en
        return obj.governorate.name_ar

class ClientServiceOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientServiceOption
        fields = ['id', 'option_text', 'price', 'is_active']

class ClientServiceQuestionSerializer(serializers.ModelSerializer):
    options = ClientServiceOptionSerializer(many=True, read_only=True)

    class Meta:
        model = ClientServiceQuestion
        fields = ['id', 'question_text', 'is_active', 'show_to_client', 'options']

class ServicePriceSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServicePriceSetting
        fields = ("id", "name", "price", "is_active")

class JoinAdahiGroupSerializer(serializers.Serializer):
    code = serializers.CharField(required=True)

class AnimalListingSimpleSerializer(serializers.ModelSerializer):
    price_per_share = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = AnimalListing
        fields = [
            'id', 'animal', 'section', 'price',
            'total_shares', 'available_shares', 'is_active', 'price_per_share'
        ]
        read_only_fields = ['price_per_share']

