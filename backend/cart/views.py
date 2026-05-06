from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.authentication import SessionAuthentication
from django.db import transaction

from accounts.permissions import IsCustomerUser
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer
from livestock.models import Animal
from orders.services import PricingService

class MergeGuestCartAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        guest_cart_items = request.data.get('guest_cart_items', [])

        if not isinstance(guest_cart_items, list):
            return Response(
                {"detail": "Invalid data format."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user

        with transaction.atomic():
            cart, _ = Cart.objects.select_for_update().get_or_create(user=user)

            for item_data in guest_cart_items:
                animal_id = item_data.get('animal_id')
                if not animal_id:
                    continue

                try:
                    animal = Animal.objects.select_for_update().get(
                        id=animal_id,
                        status='available'
                    )
                    share_quantity = int(item_data.get('share_quantity', 1))
                    selected_services = item_data.get('selected_services', {})

                    if share_quantity <= 0 or share_quantity > 100:
                        continue

                    price_details = PricingService.calculate_item_price(
                        animal=animal,
                        share_qty=share_quantity,
                        services=selected_services,
                        user=user
                    )

                    price_to_save = price_details.get(
                        'final_price',
                        animal.price_after_discount
                    )

                    CartItem.objects.update_or_create(
                        cart=cart,
                        animal=animal,
                        defaults={
                            'price_per_item': price_to_save,
                            'share_quantity': share_quantity,
                            'selected_services': selected_services,
                            'pipeline': item_data.get('pipeline', 'M')
                        }
                    )

                except (Animal.DoesNotExist, ValueError):
                    continue

        return Response(
            {"detail": "تم دمج وتحديث السلة بنجاح."},
            status=status.HTTP_200_OK
        )

class CartViewSet(viewsets.ModelViewSet):
    serializer_class = CartSerializer
    permission_classes = [IsCustomerUser]

    def get_queryset(self):
        return Cart.objects.filter(user=self.request.user)

    def _get_or_create_cart(self):
        return Cart.objects.get_or_create(user=self.request.user)

    def list(self, request, *args, **kwargs):
        cart, _ = self._get_or_create_cart()

        cart_qs = Cart.objects.filter(pk=cart.pk).prefetch_related(
            'items__animal__category',
            'items__animal__category__growth_rates'
        ).first()

        if not cart_qs:
            return Response({"items": [], "cart_totals": {}})

        serializer = CartSerializer(cart_qs, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        cart = serializer.save()

        cart_full = Cart.objects.prefetch_related(
            'items__animal__category',
            'items__animal__category__growth_rates'
        ).get(pk=cart.pk)

        final_serializer = CartSerializer(
            cart_full,
            context={'request': request}
        )
        return Response(
            final_serializer.data,
            status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, *args, **kwargs):
        raise NotFound(
            "غير مسموح باستعراض سلة معينة. استخدم /api/cart/ لاستعراض سلة المستخدم."
        )

    def partial_update(self, request, *args, **kwargs):
        return Response(
            {"detail": "تعديل السلة غير مدعوم. استخدم /api/cart/items/<id>/ للحذف."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        cart_qs = self.get_queryset()
        if not cart_qs.exists():
            return Response(status=status.HTTP_204_NO_CONTENT)

        cart = cart_qs.first()
        cart.items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class CartItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCustomerUser]
    serializer_class = CartItemSerializer

    def get_queryset(self):
        return CartItem.objects.filter(
            cart__user=self.request.user
        ).select_related('animal__category')

    def perform_create(self, serializer):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)

        if cart.items.count() >= 3:
            raise ValidationError(
                {"detail": "السلة ممتلئة! الحد الأقصى للطلب الواحد هو 3 حيوانات فقط لضمان جودة التجهيز."}
            )

        animal = serializer.validated_data.get('animal')
        if CartItem.objects.filter(cart=cart, animal=animal).exists():
            raise ValidationError(
                {"detail": "هذا الحيوان موجود بالفعل في سلتك"}
            )

        serializer.save(cart=cart)

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "التعديل غير مسموح به. احذف العنصر وأضفه من جديد بالخيارات الصحيحة."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class GuestCartAPIView(APIView):
    authentication_classes =[]
    permission_classes = [AllowAny]
    SESSION_CART_KEY = 'guest_cart_items'
    SESSION_PENDING_BOOKING_KEY = 'pending_booking_data'

    def get(self, request, *args, **kwargs):
        guest_items = request.session.get(self.SESSION_CART_KEY, [])
        pending_booking = request.session.get(
            self.SESSION_PENDING_BOOKING_KEY,
            None
        )

        detailed_items = []
        for item in guest_items:
            try:
                animal = Animal.objects.get(id=item['animal_id'])
                detailed_items.append({
                    'animal_id': animal.id,
                    'animal_unique_id': str(animal.unique_id),
                    'animal_code': animal.code,
                    'animal_name': animal.name,
                    'price_per_item': str(animal.price_egp),
                    'total_price': str(animal.price_egp),
                    'share_quantity': item.get('share_quantity', 1),
                    'selected_services': item.get('selected_services', {})
                })
            except Animal.DoesNotExist:
                continue

        response_data = {
            'items': detailed_items,
            'pending_booking': pending_booking
        }
        return Response(response_data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        animal_id = request.data.get('animal_id')
        share_quantity = request.data.get('share_quantity', 1)
        selected_services = request.data.get('selected_services', {})

        if not animal_id:
            raise ValidationError({"animal_id": "مطلوب تحديد الحيوان."})

        try:
            animal = Animal.objects.get(id=animal_id)
        except Animal.DoesNotExist:
            raise NotFound("الحيوان غير موجود.")

        if not isinstance(selected_services, dict):
            selected_services = {}

        guest_items = request.session.get(self.SESSION_CART_KEY, [])
        item_found = any(item['animal_id'] == animal_id for item in guest_items)

        share_quantity = int(share_quantity)
        if share_quantity <= 0 or share_quantity > 100:
            raise ValidationError({"share_quantity": "كمية غير صالحة."})

        if not item_found:
            guest_items.append({
                'animal_id': animal_id,
                'share_quantity': share_quantity,
                'selected_services': selected_services
            })

        request.session[self.SESSION_CART_KEY] = guest_items
        request.session.modified = True

        return Response(
            {"detail": "تمت إضافة العنصر إلى السلة المؤقتة."},
            status=status.HTTP_200_OK
        )

    def patch(self, request, *args, **kwargs):
        raise ValidationError({"detail": "تعديل الكمية غير مدعوم."})

    def delete(self, request, *args, **kwargs):
        animal_id = request.data.get('animal_id')

        if animal_id:
            guest_items = request.session.get(self.SESSION_CART_KEY, [])
            updated_items = [
                item for item in guest_items
                if item['animal_id'] != animal_id
            ]

            if len(updated_items) == len(guest_items):
                raise NotFound("العنصر غير موجود في السلة لحذفه.")

            request.session[self.SESSION_CART_KEY] = updated_items
            request.session.modified = True

            return Response(
                {"detail": "تم حذف العنصر من السلة المؤقتة."},
                status=status.HTTP_200_OK
            )
        else:
            if self.SESSION_CART_KEY in request.session:
                del request.session[self.SESSION_CART_KEY]
                request.session.modified = True
            if self.SESSION_PENDING_BOOKING_KEY in request.session:
                del request.session[self.SESSION_PENDING_BOOKING_KEY]
                request.session.modified = True
            return Response(
                {"detail": "تم تفريغ السلة المؤقتة."},
                status=status.HTTP_200_OK
            )
