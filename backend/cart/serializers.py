# cart/serializers.py
from rest_framework import serializers
from .models import Cart, CartItem
from livestock.models import Animal
from orders.services import PricingService
import logging

logger = logging.getLogger(__name__)

class AnimalSimpleSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    current_weight = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
        source='annotated_current_weight'
    )
    max_shares = serializers.SerializerMethodField()
    extra_delivery_fee = serializers.DecimalField(
        source='category.extra_delivery_fee',
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    default_max_shares = serializers.IntegerField(
        source='category.default_max_shares',
        read_only=True
    )
    allow_deposit = serializers.BooleanField(
        source='category.allow_deposit',
        read_only=True
    )
    min_deposit_percentage = serializers.DecimalField(
        source='category.min_deposit_percentage',
        max_digits=5, decimal_places=2, read_only=True
    )
    service_deposit_percentage = serializers.DecimalField(
        source='category.service_deposit_percentage',
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = Animal
        fields = [
            "id", "unique_id", "code", "price_egp",
            "price_after_discount", "is_shareable",
            "max_shares", "image", "category_name",
            "current_weight", "extra_delivery_fee", "default_max_shares",
            "allow_deposit", "min_deposit_percentage", "service_deposit_percentage",
            "status", "discount_percent", "has_discount", "is_offer"
        ]

    def get_category_name(self, obj):
        from django.utils.translation import get_language
        if obj.category:
            return obj.category.name_en if (get_language() == 'en' and obj.category.name_en) else obj.category.name_ar
        return ''

    def get_max_shares(self, obj):
        if obj.category and obj.category.logic_type in ['cow', 'camel']:
            return 7
        return 1

class CartItemSerializer(serializers.ModelSerializer):
    animal = AnimalSimpleSerializer(read_only=True)
    calculated_details = serializers.SerializerMethodField(read_only=True)
    animal_id = serializers.PrimaryKeyRelatedField(
        queryset=Animal.objects.filter(status='available'),
        source='animal',
        write_only=True
    )
    pipeline = serializers.ChoiceField(
        choices=['M', 'S', 'G'],
        default='M',
        required=False
    )

    class Meta:
        model = CartItem
        fields = [
            "id", "animal", "animal_id", "share_quantity",
            "selected_services", "pipeline", "calculated_details"
        ]
        read_only_fields = ['id', 'animal', 'calculated_details']
        extra_kwargs = {
            'share_quantity': {
                'required': False,
                'default': 1,
                'min_value': 1
            },
            'selected_services': {
                'required': False,
                'default': dict
            }
        }

    def get_calculated_details(self, obj):
        try:
            request = self.context.get('request')
            if not request:
                return None

            user = request.user if request.user.is_authenticated else None
            pipeline = obj.pipeline or 'M'

            section = None
            if obj.selected_services:
                section = obj.selected_services.get('_order_context')

            return PricingService.calculate_item_price(
                animal=obj.animal,
                share_qty=obj.share_quantity,
                services=obj.selected_services,
                user=user,
                pipeline=pipeline,
                section=section
            )
        except Exception as e:
            logger.error(f"Error calculating item price for cart item {obj.id}: {e}")
            return {
                'final_price': 0,
                'discount_amount': 0,
                'error': str(e)
            }

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    animal_id = serializers.PrimaryKeyRelatedField(
        queryset=Animal.objects.filter(status='available'),
        write_only=True,
        required=False
    )
    pipeline = serializers.ChoiceField(
        choices=['M', 'S', 'G'],
        default='M',
        write_only=True,
        required=False
    )
    cart_totals = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "user", "items", "animal_id", "pipeline", "cart_totals"]
        read_only_fields = ["user", "cart_totals"]

    def get_cart_totals(self, obj):
        try:
            request = self.context.get('request')
            user = request.user if request else None

            total, items_details, voucher_discount = PricingService.calculate_cart_totals(
                cart=obj,
                user=user
            )

            return {
                "total_price": float(total),
                "items_count": obj.items.count(),
                "voucher_discount": float(voucher_discount),
                "details": items_details
            }
        except Exception as e:
            logger.error(f"Error calculating cart totals for cart {obj.id}: {e}")
            return {
                "total_price": 0,
                "items_count": 0,
                "voucher_discount": 0,
                "details": []
            }

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if 'items' in self.fields:
            self.fields['items'].context.update(self.context)
        return representation

    def validate_animal_id(self, value):
        if value.status != 'available':
            raise serializers.ValidationError("الحيوان غير متاح للشراء حالياً")
        return value

    def validate_pipeline(self, value):
        if value not in ['M', 'S', 'G']:
            raise serializers.ValidationError("قيمة الماسورة غير صحيحة")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("يجب تسجيل الدخول لإضافة عناصر للسلة")

        user = request.user
        cart, _ = Cart.objects.get_or_create(user=user)

        animal = validated_data.pop("animal_id", None)
        pipeline = validated_data.pop("pipeline", "M")

        if animal:
            if cart.items.filter(animal=animal, pipeline=pipeline).exists():
                raise serializers.ValidationError("هذا الحيوان مضاف بالفعل إلى السلة بنفس الماسورة")

            try:
                price_calc = PricingService.calculate_item_price(
                    animal=animal,
                    share_qty=1,
                    services={},
                    user=user,
                    pipeline=pipeline
                )

                CartItem.objects.create(
                    cart=cart,
                    animal=animal,
                    pipeline=pipeline,
                    price_per_item=price_calc.get('final_price', animal.price_after_discount),
                    share_quantity=1,
                    selected_services={}
                )
            except Exception as e:
                logger.error(f"Error creating cart item: {e}")
                raise serializers.ValidationError("حدث خطأ أثناء إضافة الحيوان إلى السلة")

        return cart

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        pipeline = validated_data.get("pipeline", "M")

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                animal = item_data.get("animal")
                if animal and animal.status == 'available':
                    try:
                        price_calc = PricingService.calculate_item_price(
                            animal=animal,
                            share_qty=1,
                            services={},
                            user=instance.user,
                            pipeline=pipeline
                        )

                        CartItem.objects.create(
                            cart=instance,
                            animal=animal,
                            pipeline=pipeline,
                            price_per_item=price_calc.get('final_price', animal.price_after_discount),
                            share_quantity=1,
                            selected_services={}
                        )
                    except Exception as e:
                        logger.error(f"Error updating cart item: {e}")
                        continue

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance
