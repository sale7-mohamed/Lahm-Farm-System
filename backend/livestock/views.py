from django.shortcuts import get_object_or_404
from django.db.models import Q, Subquery, OuterRef, Case, When, DecimalField, F, Sum, ExpressionWrapper, Value
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, generics
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.generics import ListAPIView
from rest_framework.filters import SearchFilter, OrderingFilter
from datetime import date, timedelta
from django.db import transaction, models
from django.http import HttpResponseRedirect
from decimal import Decimal
from django.core.files.base import ContentFile
from orders.models import Order, OrderItem
from orders.services import PricingService
from django.utils import timezone
from accounts.models import User as CustomerUser
from notifications.utils import send_notification
from dateutil.relativedelta import relativedelta
from core.models import OperationSettings

from .models import (
    Category, Animal, AnimalImage, CategoryGrowthRate,
    ClientServiceQuestion, DeliverySetting,
    DeliveryArea, ClientServiceOption, ServicePriceSetting,
    AdahiGroup, AnimalListing
)
from .serializers import (
    CategorySerializer,
    AnimalSerializer,
    AnimalCreateSerializer,
    AnimalImageSerializer,
    AnimalHomeSerializer,
    CategoryHomeSerializer,
    DeliveryAreaSerializer,
    ClientServiceQuestionSerializer,
    ServicePriceSettingSerializer,
    DeliverySettingSerializer,
    AdahiGroupSerializer,
    PipelineListingSerializer
)
from management.permissions import IsManagementUser
from management.models import WeightLog, Employee, ApprovalRequest, SystemModule, AccessLevel
from management.permissions_engine import get_effective_access, get_approver_for_module
from .filters import AnimalFilter

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class MarketPipelineViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PipelineListingSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination
    filter_backends = [OrderingFilter, DjangoFilterBackend]
    ordering_fields = ['price', 'created_at']

    def get_queryset(self):
        queryset = AnimalListing.objects.filter(
            pipeline='M',
            section='full_sale',
            is_active=True,
            animal__status='available',
            animal__is_hidden_from_store=False
        ).select_related('animal', 'animal__category').prefetch_related('animal__images').order_by('-id')

        latest_weight = WeightLog.objects.filter(
            animal=OuterRef('animal_id')
        ).order_by('-date', '-id').values('weight_kg')[:1]

        queryset = queryset.annotate(
            annotated_current_weight=Subquery(latest_weight, output_field=DecimalField()),
            annotated_price_after_discount=F('price')
        )

        category = self.request.query_params.get('category')
        if category:
            cat_list = [c.strip() for c in category.split(',') if c.strip()]
            cat_ids = [int(c) for c in cat_list if c.isdigit()]
            cat_slugs = [c for c in cat_list if not c.isdigit()]

            q_cat = Q()
            if cat_ids:
                q_cat |= Q(animal__category_id__in=cat_ids)
            if cat_slugs:
                q_cat |= Q(animal__category__slug__in=cat_slugs)

            if q_cat:
                queryset = queryset.filter(q_cat)

        has_discount = self.request.query_params.get('has_discount')
        if has_discount == 'true':
            queryset = queryset.filter(animal__is_offer=True, animal__discount_percent__gt=0)

        sex = self.request.query_params.get('sex')
        if sex and sex in ['male', 'female']:
            queryset = queryset.filter(animal__sex=sex)

        price_min = self.request.query_params.get('price_min')
        if price_min:
            try:
                price_min_float = Decimal(price_min)
                if price_min_float >= 0:
                    queryset = queryset.filter(annotated_price_after_discount__gte=price_min_float)
            except (ValueError, TypeError):
                pass

        price_max = self.request.query_params.get('price_max')
        if price_max:
            try:
                price_max_float = Decimal(price_max)
                if price_max_float >= 0:
                    queryset = queryset.filter(annotated_price_after_discount__lte=price_max_float)
            except (ValueError, TypeError):
                pass

        weight_min = self.request.query_params.get('weight_min')
        if weight_min:
            try:
                weight_min_float = Decimal(weight_min)
                if weight_min_float >= 0:
                    queryset = queryset.filter(annotated_current_weight__gte=weight_min_float)
            except (ValueError, TypeError):
                pass

        weight_max = self.request.query_params.get('weight_max')
        if weight_max:
            try:
                weight_max_float = Decimal(weight_max)
                if weight_max_float >= 0:
                    queryset = queryset.filter(annotated_current_weight__lte=weight_max_float)
            except (ValueError, TypeError):
                pass

        age_min = self.request.query_params.get('age_min')
        age_max = self.request.query_params.get('age_max')
        today = date.today()

        if age_max:
            try:
                age_max_int = int(age_max)
                if age_max_int >= 0:
                    min_birth_date = today - relativedelta(months=age_max_int)
                    queryset = queryset.filter(animal__birth_date__gte=min_birth_date)
            except (ValueError, TypeError):
                pass

        if age_min:
            try:
                age_min_int = int(age_min)
                if age_min_int >= 0:
                    max_birth_date = today - relativedelta(months=age_min_int)
                    queryset = queryset.filter(animal__birth_date__lte=max_birth_date)
            except (ValueError, TypeError):
                pass

        search = self.request.query_params.get('search')
        if search:
            search = search.strip().lower()
            if search:
                import re
                from django.db.models.functions import Replace
                from django.db.models import Value
                q_obj = Q()

                synonyms = {
                    'بقرة': ['بقر', 'عجول'], 'بقر':['بقر', 'عجول'], 'عجل': ['بقر', 'عجول'], 'جاموس':['بقر', 'عجول'],
                    'خروف': ['ضأن', 'خراف'], 'ضأن': ['ضأن', 'خراف'], 'خراف': ['ضأن', 'خراف'],
                    'ماعز': ['ماعز'], 'جدي': ['ماعز'],
                    'جمل':['إبل', 'جمال'], 'ابل': ['إبل', 'جمال']
                }

                for key, mapped_cats in synonyms.items():
                    if key in search:
                        for cat in mapped_cats:
                            q_obj |= Q(animal__category__name_ar__icontains=cat)

                clean_value = search.replace(' ', '').replace('#', '')

                if 'clean_code' not in queryset.query.annotations:
                    queryset = queryset.annotate(
                        clean_code=Replace(Replace('animal__code', Value(' '), Value('')), Value('#'), Value(''))
                    )

                breed_query = Q()
                for word in search.split():
                    breed_query |= Q(animal__breed__icontains=word)

                q_obj |= (
                    Q(clean_code__icontains=clean_value) |
                    breed_query |
                    Q(animal__description__icontains=search) |
                    Q(animal__category__name_ar__icontains=search)
                )

                numbers = re.findall(r'\d+(?:\.\d+)?', search)
                if numbers:
                    num_val = float(numbers[0])
                    if num_val < 2000:
                        min_weight = num_val * 0.8
                        max_weight = num_val * 1.2
                        q_obj |= Q(annotated_current_weight__gte=min_weight, annotated_current_weight__lte=max_weight)

                queryset = queryset.filter(q_obj)

        ordering = self.request.query_params.get('ordering')
        if ordering:
            if ordering == 'annotated_price_after_discount':
                queryset = queryset.order_by('annotated_price_after_discount')
            elif ordering == '-annotated_price_after_discount':
                queryset = queryset.order_by('-annotated_price_after_discount')
            elif ordering == 'annotated_current_weight':
                queryset = queryset.order_by('annotated_current_weight')
            elif ordering == '-annotated_current_weight':
                queryset = queryset.order_by('-annotated_current_weight')
            elif ordering == '-created_at':
                queryset = queryset.order_by('-created_at')
            elif ordering == 'created_at':
                queryset = queryset.order_by('created_at')
            else:
                queryset = queryset.order_by('-created_at')
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

class SacrificePipelineViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PipelineListingSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        section = self.request.query_params.get('section')
        queryset = AnimalListing.objects.filter(
            pipeline='S',
            is_active=True,
            animal__status='available',
            animal__is_hidden_from_store=False,
            animal__has_defect=False
        ).select_related('animal', 'animal__category').prefetch_related('animal__images').order_by('-id')

        if section:
            queryset = queryset.filter(section=section)
        return queryset

    @action(detail=False, methods=['get'], url_path='adahi-pool')
    def adahi_pool_list(self, request):
        queryset = self.get_queryset().filter(section='adahi_pool')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='adahi-full')
    def adahi_full_list(self, request):
        queryset = self.get_queryset().filter(section='adahi_full')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class SharesPipelineViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PipelineListingSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return AnimalListing.objects.filter(
            pipeline='G',
            section='shares',
            is_active=True,
            animal__status='available',
            animal__is_hidden_from_store=False
        ).select_related('animal', 'animal__category').prefetch_related('animal__images').order_by('-id')

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name_ar')
    serializer_class = CategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsManagementUser()]

    @action(detail=True, methods=['post'], url_path='update-rates')
    def update_growth_rates(self, request, pk=None):
        if not isinstance(request.data.get('rates'), list):
            return Response({'error': 'يجب إرسال قائمة بالمعدلات'}, status=status.HTTP_400_BAD_REQUEST)

        category = self.get_object()
        rates_data = request.data.get('rates', [])

        with transaction.atomic():
            CategoryGrowthRate.objects.filter(category=category).delete()
            new_rates = []
            for rate in rates_data:
                if not isinstance(rate, dict):
                    continue
                if not all(key in rate for key in ['min_weight', 'max_weight', 'daily_increase']):
                    continue
                try:
                    new_rates.append(CategoryGrowthRate(
                        category=category,
                        min_weight=float(rate['min_weight']),
                        max_weight=float(rate['max_weight']),
                        daily_increase=float(rate['daily_increase'])
                    ))
                except (ValueError, TypeError):
                    continue
            if new_rates:
                CategoryGrowthRate.objects.bulk_create(new_rates)

        return Response({'status': 'updated'})

class AnimalViewSet(viewsets.ModelViewSet):
    serializer_class = AnimalSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AnimalFilter
    search_fields = ['code', 'name', 'category__name_ar', 'description']
    ordering_fields = ['created_at', 'price_egp', 'current_weight']
    lookup_field = 'unique_id'

    def check_module_permission(self, action_type):
        access = get_effective_access(self.request.user, SystemModule.LIVESTOCK)
        if access == AccessLevel.NO_ACCESS:
            raise PermissionDenied("ليس لديك صلاحية للوصول لهذه الشاشة.")
        if access == AccessLevel.VIEW_ONLY and action_type in ['update', 'delete', 'create']:
            raise PermissionDenied("صلاحيتك للمشاهدة فقط.")
        return access

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_val = self.kwargs.get(lookup_url_kwarg)

        try:
            import uuid
            uuid_obj = uuid.UUID(str(lookup_val))
            filter_kwargs = {self.lookup_field: uuid_obj}
        except ValueError:
            if str(lookup_val).isdigit():
                filter_kwargs = {'id': lookup_val}
            else:
                raise NotFound("الحيوان غير موجود أو الرابط غير صحيح.")

        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)

        user = self.request.user
        is_staff = user.is_authenticated and (user.is_staff or getattr(user, 'employee_profile', None) is not None)

        if not is_staff:
            if obj.is_hidden_from_store:
                raise NotFound("الحيوان غير موجود")
            if obj.status == 'lost':
                raise NotFound("الحيوان غير متاح")
        return obj

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'list_adahi_pool', 'join_private_group',
                          'adahi_full_candidates', 'visible_in_shares', 'visible_in_adahi_pool',
                          'available_for_private_groups','eid_prediction', 'sacrifice_status',
                          'available_for_shares']:
            return [AllowAny()]

        if self.action in ['create', 'get_pool_candidates', 'toggle_pool_status',
                          'get_adahi_pool_candidates', 'toggle_adahi_pool',
                          'get_shares_candidates', 'toggle_normal_share', 'lock_animal',
                          'upload_image', 'reorder_images', 'bulk_action', 'restore_to_store']:
            return [IsManagementUser()]

        return [IsManagementUser()]

    def get_serializer_class(self):
        if self.action == 'create':
            return AnimalCreateSerializer
        return AnimalSerializer

    @action(detail=True, methods=['post'], url_path='set-main-image')
    def set_main_image(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        image_id = request.data.get('image_id')
        if not image_id:
            return Response({"detail": "Image ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            animal_image = AnimalImage.objects.get(id=int(image_id), animal=animal)
            if animal_image.image:
                with animal_image.image.open() as f:
                    data = f.read()
                file_name = f"main_{animal.code}_{image_id}.jpg"
                animal.image.save(file_name, ContentFile(data), save=True)
            return Response(self.get_serializer(animal).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='visible-in-shares')
    def visible_in_shares(self, request):
        queryset = Animal.objects.filter(
            status='available',
            is_hidden_from_store=False,
            has_defect=False
        ).distinct().order_by("-id")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='adahi-pool')
    def list_adahi_pool(self, request):
        queryset = Animal.objects.filter(
            status='available',
            is_hidden_from_store=False,
            has_defect=False
        ).distinct().order_by("-id")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='adahi-pool-candidates')
    def get_adahi_pool_candidates(self, request):
        queryset = self.get_queryset().filter(
            status='available',
            has_defect=False
        ).exclude(
            orderitem__order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed']
        ).distinct().order_by("-id")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='available-for-private-groups')
    def available_for_private_groups(self, request):
        queryset = Animal.objects.filter(
            status='available',
            category__logic_type__in=['cow', 'camel'],
            has_defect=False,
            is_hidden_from_store=False,
        ).select_related('category', 'source_farm')

        queryset = queryset.filter(
            ~Q(orderitem__order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed'])
        ).distinct()

        latest_weight = WeightLog.objects.filter(
            animal=OuterRef('pk')
        ).order_by('-date').values('weight_kg')[:1]

        queryset = queryset.annotate(
            annotated_current_weight=Subquery(latest_weight),
            annotated_price_after_discount=Case(
                When(
                    is_offer=True,
                    discount_percent__gt=0,
                    then=F('price_egp') * (1 - F('discount_percent') / 100)
                ),
                default=F('price_egp'),
                output_field=DecimalField()
            )
        ).order_by("-id")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=['post'], url_path='lock-animal')
    def lock_animal(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        lock_type = request.data.get('lock_type')

        valid_lock_types = ['full_sale', 'shares', 'adahi_pool', 'private_group']
        if lock_type not in valid_lock_types:
            return Response({"detail": "نوع القفل غير صالح"}, status=status.HTTP_400_BAD_REQUEST)

        if animal.lock_type != 'none' and animal.lock_type != lock_type:
            return Response({"detail": "الحيوان مقفل بالفعل لنوع آخر من البيع"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            animal.lock_type = lock_type
            animal.first_sale_at = timezone.now()
            animal.save()

        return Response({
            "status": "success",
            "lock_type": animal.lock_type,
            "message": f"تم قفل الحيوان للنظام: {lock_type}"
        })

    @action(detail=True, methods=['post'], url_path='restore-to-store', permission_classes=[IsManagementUser])
    @transaction.atomic
    def restore_to_store(self, request, unique_id=None, pk=None):
        animal = self.get_object()

        if animal.status not in ['available', 'reserved']:
            return Response({"detail": "لا يمكن إعادة حيوان مباع أو مفقود."}, status=400)

        active_orders = Order.objects.filter(
            items__animal=animal,
            status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'out_for_delivery']
        )
        for order in active_orders:
            order.status = 'canceled'
            order.notes = (order.notes or '') + "\n[نظام]: تم الإلغاء تلقائياً بسبب إنقاذ الحيوان وإعادته للمتجر."
            order.save(update_fields=['status', 'notes'])

        AdahiGroup.objects.filter(listing__animal=animal).delete()

        AnimalListing.objects.filter(animal=animal).update(is_active=False)

        listing_m, _ = AnimalListing.objects.get_or_create(
            animal=animal,
            pipeline='M',
            section='full_sale',
            defaults={
                'price': animal.price_after_discount or animal.price_egp,
                'total_shares': 1,
                'available_shares': 1,
                'is_active': True
            }
        )
        listing_m.is_active = True
        listing_m.available_shares = listing_m.total_shares
        listing_m.save()

        if animal.is_sacrifice_valid_now and not animal.has_defect:
            listing_full, _ = AnimalListing.objects.get_or_create(
                animal=animal,
                pipeline='S',
                section='adahi_full',
                defaults={
                    'price': animal.price_after_discount or animal.price_egp,
                    'total_shares': 1,
                    'available_shares': 1,
                    'is_active': True
                }
            )
            listing_full.is_active = True
            listing_full.available_shares = listing_full.total_shares
            listing_full.save()

        animal.is_hidden_from_store = False
        animal.has_defect = False
        animal.is_shareable = False
        animal.status = 'available'
        animal.save()

        return Response({"detail": "تم إنقاذ الحيوان وإعادته للسوق المواشي بنجاح."})

    @action(detail=False, methods=['get'], url_path='available-for-shares')
    def available_for_shares(self, request):
        queryset = Animal.objects.filter(
            status='available',
            is_hidden_from_store=False,
            has_defect=False
        ).exclude(
            Q(listings__pipeline='G', listings__section='shares', listings__is_active=True) |
            Q(orderitem__order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed'])
        ).distinct().select_related('category')

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='adahi-full-candidates')
    def adahi_full_candidates(self, request):
        queryset = Animal.objects.filter(
            status='available',
            has_defect=False,
            is_hidden_from_store=False,
            listings__section='adahi_full',
            listings__is_active=True
        ).select_related('category', 'source_farm').distinct()

        latest_weight = WeightLog.objects.filter(animal=OuterRef('pk')).order_by('-date').values('weight_kg')[:1]
        queryset = queryset.annotate(
            annotated_current_weight=Subquery(latest_weight),
            annotated_price_after_discount=Case(
                When(is_offer=True, discount_percent__gt=0, then=F('price_egp') * (1 - F('discount_percent') / 100)),
                default=F('price_egp'),
                output_field=DecimalField()
            )
        ).order_by("-id")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.get_serializer(queryset, many=True).data)

    def create(self, request, *args, **kwargs):
        access = get_effective_access(request.user, SystemModule.LIVESTOCK)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية للوصول لهذه الشاشة.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        initial_weight_kg = serializer.validated_data.pop('initial_weight_kg', None)
        if initial_weight_kg is None:
            raise ValidationError({'initial_weight_kg': 'هذا الحقل مطلوب عند إنشاء حيوان جديد.'})

        initial_weight_date = serializer.validated_data.pop('initial_weight_date', date.today())
        additional_images = serializer.validated_data.pop('images', [])

        with transaction.atomic():
            self.perform_create(serializer)
            animal_instance = serializer.instance

            if initial_weight_kg <= 0:
                raise ValidationError({'initial_weight_kg': 'الوزن يجب أن يكون أكبر من صفر.'})

            WeightLog.objects.create(
                animal=animal_instance,
                date=initial_weight_date,
                weight_kg=initial_weight_kg,
                recorded_by=request.user
            )

            max_images = 10
            max_file_size = 10 * 1024 * 1024

            for image_file in additional_images[:max_images]:
                if hasattr(image_file, 'size') and image_file.size > max_file_size:
                    continue
                AnimalImage.objects.create(animal=animal_instance, image=image_file)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        access = self.check_module_permission('update')

        if access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.LIVESTOCK)
            if not approver:
                raise PermissionDenied("لم يتم تعيين مسؤول للموافقات. يرجى مراجعة الإدارة.")

            instance = self.get_object()
            ApprovalRequest.objects.create(
                requester=request.user,
                approver=approver,
                action_type='update_animal',
                target_module=SystemModule.LIVESTOCK,
                target_object_id=instance.id,
                details={'animal_code': instance.code},
                pending_data=request.data,
                status='pending'
            )
            return Response({"detail": "تم إرسال طلب التعديل للمسؤول للموافقة."}, status=200)

        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        deleted_media_ids = request.data.get('deleted_media_ids', '')
        if deleted_media_ids:
            ids_to_delete = [int(id) for id in deleted_media_ids.split(',') if id.isdigit()]
            AnimalImage.objects.filter(id__in=ids_to_delete, animal=instance).delete()

        new_media_files = request.FILES.getlist('new_media')
        for file in new_media_files:
            AnimalImage.objects.create(animal=instance, image=file)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        access = self.check_module_permission('delete')

        if access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.LIVESTOCK)
            if not approver:
                raise PermissionDenied("لم يتم تعيين مسؤول للموافقات. يرجى مراجعة الإدارة.")

            instance = self.get_object()
            ApprovalRequest.objects.create(
                requester=request.user,
                approver=approver,
                action_type='delete_animal',
                target_module=SystemModule.LIVESTOCK,
                target_object_id=instance.id,
                details={'animal_code': instance.code},
                status='pending'
            )
            return Response({"detail": "تم إرسال طلب الحذف للمسؤول للموافقة."}, status=200)

        instance = self.get_object()
        requester = request.user

        if requester.is_superuser:
            instance.delete()
            return Response({"detail": "تم حذف الحيوان بنجاح."}, status=status.HTTP_200_OK)

        approver = Employee.objects.filter(
            Q(role__name__icontains='مدير') | Q(is_superuser=True)
        ).exclude(pk=requester.pk).first()

        if not approver:
            raise PermissionDenied("لا يوجد مدير متاح للموافقة على طلب الحذف.")

        if ApprovalRequest.objects.filter(
            action_type='delete_animal',
            details__animal_id=instance.id,
            status='pending'
        ).exists():
            raise PermissionDenied("يوجد بالفعل طلب حذف معلق لهذا الحيوان.")

        ApprovalRequest.objects.create(
            requester=requester,
            approver=approver,
            action_type='delete_animal',
            details={
                'animal_id': instance.id,
                'animal_code': instance.code,
                'requester_name': requester.full_name
            },
            status='pending'
        )
        return Response({"detail": "تم إرسال طلب الحذف للموافقة."}, status=status.HTTP_200_OK)

    def get_queryset(self):
        qs = Animal.objects.select_related('source_farm', 'category')

        latest_weight = WeightLog.objects.filter(
            animal=OuterRef('pk')
        ).order_by('-date', '-id').values('weight_kg')[:1]

        latest_weight_date = WeightLog.objects.filter(
            animal=OuterRef('pk')
        ).order_by('-date', '-id').values('date')[:1]

        qs = qs.annotate(
            annotated_current_weight=Subquery(latest_weight),
            annotated_last_weight_date=Subquery(latest_weight_date),
            annotated_price_after_discount=Case(
                When(is_offer=True, discount_percent__gt=0, then=F('price_egp') * (1 - F('discount_percent') / 100)),
                default=F('price_egp'),
                output_field=DecimalField()
            )
        )

        is_staff = self.request.user.is_authenticated and (self.request.user.is_staff or getattr(self.request.user, 'employee_profile', None) is not None)

        if not is_staff:
            user = self.request.user
            if user.is_authenticated:
                qs = qs.filter(
                    Q(status='available', is_hidden_from_store=False, has_defect=False) |
                    Q(orderitem__order__user=user) |
                    Q(reservations__user=user)
                )
            else:
                qs = qs.filter(status='available', is_hidden_from_store=False, has_defect=False)

        if self.action == 'retrieve':
            qs = qs.select_related('mother', 'father').prefetch_related(
                'images',
                'weight_logs',
                'health_logs__vet',
                'feeding_logs__item'
            )

        return qs.distinct()

    @action(detail=True, methods=['post'], url_path='upload_image')
    def upload_image(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        if 'image' not in request.FILES:
            return Response({"detail": "يرجى رفع ملف صورة"}, status=status.HTTP_400_BAD_REQUEST)

        image_file = request.FILES['image']
        max_file_size = 10 * 1024 * 1024
        if image_file.size > max_file_size:
            return Response({"detail": "حجم الصورة يجب أن يكون أقل من 10 ميجابايت"}, status=status.HTTP_400_BAD_REQUEST)

        img = AnimalImage.objects.create(animal=animal, image=image_file)
        return Response(AnimalImageSerializer(img).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='eid-prediction')
    def eid_prediction(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        prediction = animal.get_eid_prediction()
        if prediction is None:
            return Response({"error": "لم يتم تعيين تاريخ العيد في الإعدادات"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(prediction)

    @action(detail=True, methods=['get'], url_path='sacrifice-status')
    def sacrifice_status(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        return Response({
            "is_valid_now": animal.is_sacrifice_valid_now,
            "has_defect": animal.has_defect,
            "logic_type": animal.category.logic_type,
            "age_months": animal.age_months,
            "current_weight": animal.current_weight,
            "current_price": animal.price_egp,
            "price_after_discount": animal.price_after_discount
        })

    @action(detail=False, methods=['post'], url_path='join-private-group', permission_classes=[AllowAny])
    def join_private_group(self, request):
        code = request.data.get('code', '').strip()
        if not code:
            return Response({"detail": "يرجى إدخال الكود."}, status=status.HTTP_400_BAD_REQUEST)

        if len(code) > 20:
            return Response({"detail": "الكود طويل جداً."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            group = AdahiGroup.objects.select_related('listing__animal').get(code__iexact=code, is_active=True)
            animal = group.listing.animal

            if animal.status != 'available':
                return Response({"detail": "عذراً، هذا الحيوان لم يعد متاحاً."}, status=status.HTTP_400_BAD_REQUEST)

            serializer = self.get_serializer(animal)
            return Response(serializer.data)

        except AdahiGroup.DoesNotExist:
            return Response({"detail": "الكود غير صحيح أو المجموعة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='pool-candidates', permission_classes=[IsManagementUser])
    def get_pool_candidates(self, request):
        queryset = self.get_queryset().filter(
            status='available',
            has_defect=False,
            category__logic_type__in=['cow', 'camel']
        ).exclude(
            Q(listings__section='adahi_group') & Q(listings__is_active=True)
        )

        valid_animals = [a for a in queryset if a.is_sacrifice_valid_now or (a.get_eid_prediction() and a.get_eid_prediction().get('is_valid'))]

        page = self.paginate_queryset(valid_animals)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(valid_animals, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='toggle-adahi-pool', permission_classes=[IsManagementUser])
    @transaction.atomic
    def toggle_pool_status(self, request, unique_id=None, pk=None):
        animal = Animal.objects.select_for_update().get(pk=self.get_object().pk)

        if animal.status == 'sold':
            return Response({"detail": "لا يمكن تعديل إعدادات حيوان تم بيعه."}, status=400)

        has_real_sales = animal.orderitem_set.exists() or animal.reservations.filter(status__in=['pending', 'confirmed']).exists()

        with transaction.atomic():
            existing_pool = AnimalListing.objects.filter(
                animal=animal, pipeline='S', section='adahi_pool', is_active=True
            ).first()

            if existing_pool:
                existing_pool.is_active = False
                existing_pool.save()

                animal.is_adahi_pool = False
                if not has_real_sales:
                    animal.is_adahi = False
                    AnimalListing.objects.filter(animal=animal, pipeline='M', section='full_sale').update(is_active=True)

                animal.save()

                return Response({
                    "status": "removed",
                    "is_adahi_pool": False,
                    "message": "تم إزالة الحيوان من مسبح الأضاحي وعودته للسوق."
                })
            else:
                pool_listing, created = AnimalListing.objects.get_or_create(
                    animal=animal, pipeline='S', section='adahi_pool',
                    defaults={
                        'price': animal.price_after_discount, 'total_shares': 7,
                        'available_shares': 7, 'is_active': True
                    }
                )
                if not created and not pool_listing.is_active:
                    pool_listing.is_active = True
                    pool_listing.save()

                AnimalListing.objects.filter(animal=animal).exclude(id=pool_listing.id).update(is_active=False)

                animal.is_adahi_pool = True
                animal.is_adahi = True
                animal.save()

                return Response({
                    "status": "added",
                    "is_adahi_pool": True,
                    "message": "تم إضافة الحيوان لمسبح الأضاحي بـ 7 أسهم."
                })

    @action(detail=True, methods=['post'], url_path='toggle-normal-share', permission_classes=[IsManagementUser])
    def toggle_normal_share(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        new_shares_count = request.data.get('max_shares')

        if animal.status == 'sold':
            return Response({"detail": "لا يمكن تعديل إعدادات حيوان تم بيعه."}, status=400)

        has_real_sales = animal.orderitem_set.exists() or animal.reservations.filter(status__in=['pending', 'confirmed']).exists()

        if has_real_sales:
            return Response({"detail": "لا يمكن تعديل إعدادات حيوان تم بدء البيع فيه."}, status=400)

        with transaction.atomic():
            if animal.is_shareable and not new_shares_count:
                animal.is_shareable = False
            else:
                animal.is_shareable = True
                if new_shares_count:
                    try:
                        shares = int(new_shares_count)
                        if shares > 0:
                            listing = animal.listings.filter(pipeline='G', section='shares').first()
                            if listing:
                                listing.total_shares = shares
                                listing.available_shares = shares
                                listing.save()
                    except:
                        pass

            animal.save()

        return Response({"status": "success", "is_shareable": animal.is_shareable})

    @action(detail=True, methods=['post'], url_path='reorder-images', permission_classes=[IsManagementUser])
    def reorder_images(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        order_data = request.data.get('order_data', [])

        if not isinstance(order_data, list):
            return Response({'detail': 'تنسيق البيانات غير صالح'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                for item in order_data:
                    img_id = item.get('id')
                    new_order = item.get('order')
                    if img_id is not None and new_order is not None:
                        AnimalImage.objects.filter(
                            id=img_id,
                            animal=animal
                        ).update(order=new_order)

            return Response({'status': 'success', 'message': 'تمت إعادة ترتيب الصور بنجاح'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='bulk-action')
    def bulk_action(self, request):
        action_type = request.data.get('action')
        ids = request.data.get('ids', [])

        if not ids or not isinstance(ids, list):
            return Response({"detail": "لم يتم تحديد أي عناصر."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = Animal.objects.filter(id__in=ids)
        count = queryset.count()

        if count == 0:
            return Response({"detail": "العناصر المحددة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                if action_type == 'delete':
                    undeletable = []
                    for animal in queryset:
                        if animal.orderitem_set.exists() or animal.reservations.exists():
                            undeletable.append(animal.code)

                    if undeletable:
                        return Response({
                            "detail": f"لا يمكن حذف الحيوانات التالية لارتباطها بطلبات أو حجوزات: {', '.join(undeletable)}"
                        }, status=status.HTTP_400_BAD_REQUEST)

                    queryset.delete()
                    message = f"تم حذف {count} حيوان بنجاح."

                elif action_type == 'hide':
                    queryset.update(is_hidden_from_store=True)
                    message = f"تم إخفاء {count} حيوان من المتجر."

                elif action_type == 'show':
                    queryset.update(is_hidden_from_store=False)
                    message = f"تم إظهار {count} حيوان في المتجر."

                elif action_type == 'mark_sold':
                    queryset.update(status='sold')
                    message = f"تم تغيير حالة {count} حيوان إلى مباع."

                elif action_type == 'mark_available':
                    queryset.update(status='available')
                    message = f"تم تغيير حالة {count} حيوان إلى متاح."

                else:
                    return Response({"detail": "إجراء غير معروف."}, status=status.HTTP_400_BAD_REQUEST)

            return Response({"detail": message, "count": count})

        except Exception as e:
            return Response({"detail": f"حدث خطأ: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class AnimalImageViewSet(viewsets.ModelViewSet):
    serializer_class = AnimalImageSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        return AnimalImage.objects.filter(animal__unique_id=self.kwargs['animal_unique_id']).order_by('order')

    def perform_create(self, serializer):
        animal = generics.get_object_or_404(Animal, unique_id=self.kwargs['animal_unique_id'])
        last_order = AnimalImage.objects.filter(animal=animal).aggregate(models.Max('order'))['order__max'] or 0
        serializer.save(animal=animal, order=last_order + 1)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_images(self, request, animal_unique_id=None):
        order_data = request.data.get('order_data', [])

        if not isinstance(order_data, list):
            return Response({'detail': 'تنسيق البيانات غير صالح'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                for item in order_data:
                    img_id = item.get('id')
                    new_order = item.get('order')
                    if img_id is not None and new_order is not None:
                        AnimalImage.objects.filter(
                            id=img_id,
                            animal__unique_id=animal_unique_id
                        ).update(order=new_order)

            return Response({'status': 'success', 'message': 'تمت إعادة ترتيب الصور بنجاح'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class AdahiGroupViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AdahiGroup.objects.all().select_related('listing__animal', 'created_by')
    serializer_class = AdahiGroupSerializer
    permission_classes = [IsManagementUser]

    @action(detail=False, methods=['get'], url_path='my-active-group', permission_classes=[AllowAny])
    def my_active_group(self, request):
        user = request.user

        if not user.is_authenticated:
            return Response(None, status=status.HTTP_200_OK)

        if not isinstance(user, CustomerUser):
            return Response({"detail": "المستخدم غير مصرح له."}, status=403)

        group = AdahiGroup.objects.filter(
            created_by=user
        ).order_by('-created_at').first()

        if not group:
            valid_statuses = ['confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed']
            group = AdahiGroup.objects.filter(
                is_active=True,
                listing__animal__orderitem__order__user=user,
                listing__animal__orderitem__order__status__in=valid_statuses
            ).distinct().order_by('-created_at').first()

        if group:
            serializer = self.get_serializer(group)
            return Response(serializer.data)

        return Response(None, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='join', permission_classes=[AllowAny])
    def join_group(self, request):
        code = request.data.get('code', '').strip()
        if not code:
            return Response({"detail": "يرجى إدخال الكود."}, status=status.HTTP_400_BAD_REQUEST)

        if len(code) > 20:
            return Response({"detail": "الكود طويل جداً."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            group = AdahiGroup.objects.select_related('listing__animal').get(code__iexact=code)
            animal = group.listing.animal

            if group.is_active and not group.listing.is_active:
                from orders.models import OrderItem
                from django.db.models import Sum
                sold = OrderItem.objects.filter(
                    animal=animal, listing_section='adahi_group',
                    order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed']
                ).aggregate(total=Sum('share_quantity'))['total'] or 0

                group.listing.is_active = True
                group.listing.available_shares = max(0, group.listing.total_shares - sold)
                group.listing.save(update_fields=['is_active', 'available_shares'])
                if animal.status != 'available':
                    animal.status = 'available'
                    animal.save(update_fields=['status'])

            serializer = AnimalSerializer(animal, context={'request': request})
            from livestock.serializers import PipelineListingSerializer
            listing_data = PipelineListingSerializer(group.listing, context={'request': request}).data

            if not group.is_active or group.listing.section == 'adahi_pool':
                if animal.status == 'sold' or group.listing.available_shares <= 0:
                    return Response({
                        "detail": "عذراً، هذه المجموعة اكتملت وتم بيعها بالكامل.",
                        "status": "sold_out"
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({
                        "detail": "هذه المجموعة لم تكتمل في الوقت المحدد وتم تحويلها إلى (مسبح أضاحي عام). سيتم توجيهك الآن لتتمكن من المشاركة.",
                        "status": "converted_to_pool",
                        "animal_data": serializer.data,
                        "group_listing": listing_data
                    }, status=status.HTTP_200_OK)

            if animal.status != 'available':
                return Response({"detail": "عذراً، هذا الحيوان لم يعد متاحاً."}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "status": "active",
                "animal_data": serializer.data,
                "group_listing": listing_data
            }, status=status.HTTP_200_OK)

        except AdahiGroup.DoesNotExist:
            return Response({"detail": "الكود غير صحيح أو المجموعة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='invite', permission_classes=[IsAuthenticated])
    def invite_friend(self, request, pk=None):
        group = self.get_object()

        if not hasattr(request.user, 'customeruser'):
            return Response({"detail": "المستخدم غير مصرح له."}, status=403)

        if group.created_by != request.user:
            return Response({"detail": "فقط منشئ المجموعة يمكنه إرسال دعوات."}, status=403)

        phone = request.data.get('phone', '').strip()
        if not phone:
            return Response({"detail": "رقم الهاتف مطلوب."}, status=400)

        if len(phone) > 15:
            return Response({"detail": "رقم الهاتف طويل جداً."}, status=400)

        try:
            phone_clean = ''.join(filter(str.isdigit, phone))
            if len(phone_clean) < 10:
                return Response({"detail": "رقم الهاتف غير صالح."}, status=400)

            phone_search = phone_clean[-10:]
            invited_user = CustomerUser.objects.get(phone__icontains=phone_search)

            if invited_user == request.user:
                return Response({"detail": "لا يمكن دعوة نفسك."}, status=400)

            sender_phone = request.user.phone

            send_notification(
                invited_user,
                title="دعوة للانضمام لأضحية",
                message=f"قام {request.user.full_name} ({sender_phone}) بدعوتك للانضمام لمجموعة أضحية خاصة. الكود: {group.code}.",
                category="livestock"
            )
            return Response({"detail": "تم إرسال الدعوة بنجاح!"})

        except CustomerUser.DoesNotExist:
            return Response({"detail": "هذا الرقم غير مسجل لدينا."}, status=404)
        except Exception as e:
            return Response({"detail": "حدث خطأ أثناء إرسال الدعوة."}, status=500)

    def destroy(self, request, *args, **kwargs):
        if not hasattr(request.user, 'customeruser') and not request.user.is_staff:
            return Response({"detail": "المستخدم غير مصرح له."}, status=403)

        group = self.get_object()
        animal = group.listing.animal
        requester = request.user

        if not hasattr(requester, 'employee') and not requester.is_superuser:
            return Response({"detail": "غير مصرح لك بتنفيذ هذا الإجراء."}, status=403)

        committed_statuses = ['confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed']

        has_committed_orders = animal.orderitem_set.filter(
            order__status__in=committed_statuses
        ).exists()

        if has_committed_orders:
            if requester.is_superuser:
                return Response({"detail": "هذه المجموعة بها طلبات مدفوعة. يرجى إلغاء الطلبات المرتبطة أولاً من صفحة الطلبات ثم فك المجموعة."}, status=400)

            approver = Employee.objects.filter(
                Q(role__name__icontains='مدير') | Q(is_superuser=True)
            ).exclude(pk=requester.pk).first()

            if not approver:
                return Response({"detail": "لا يمكن فك مجموعة مدفوعة مباشرة. لا يوجد مدير للموافقة."}, status=400)

            try:
                ApprovalRequest.objects.create(
                    requester=requester,
                    approver=approver,
                    action_type='delete_adahi_group',
                    details={
                        'group_code': group.code,
                        'animal_code': animal.code,
                        'reason': "فك حجز مجموعة بها طلبات مدفوعة (يتطلب مراجعة مالية)"
                    },
                    status='pending'
                )
                return Response({"detail": "المجموعة بها طلبات مدفوعة. تم إرسال طلب للمدير للموافقة على الفك."}, status=200)
            except Exception:
                return Response({"detail": "حدث خطأ أثناء إنشاء طلب الموافقة."}, status=500)

        with transaction.atomic():
            try:
                pending_orders = Order.objects.filter(
                    items__animal=animal,
                    status='pending'
                )

                for order in pending_orders:
                    if order.items.count() == 1:
                        order.status = 'canceled'
                        order.save()
                    else:
                        order.items.filter(animal=animal).delete()
                        order.recalc_totals()

                group.delete()

                animal.status = 'available'
                animal.is_shareable = False
                animal.is_adahi = False
                animal.save()

                return Response({"detail": "تم فك المجموعة، إلغاء الطلبات المعلقة، وإعادة الحيوان للمخزون."})

            except Exception:
                return Response({"detail": "حدث خطأ أثناء فك المجموعة."}, status=500)

    @action(detail=True, methods=['post'], url_path='convert-to-pool')
    @transaction.atomic
    def convert_to_pool(self, request, pk=None):
        group = self.get_object()
        animal = group.listing.animal
        group_listing = group.listing

        if animal.status == 'sold' and group_listing.available_shares > 0:
            animal.status = 'available'
            animal.save(update_fields=['status'])

        pool_listing, created = AnimalListing.objects.get_or_create(
            animal=animal,
            pipeline='S',
            section='adahi_pool',
            defaults={
                'price': group_listing.price,
                'total_shares': group_listing.total_shares,
                'available_shares': group_listing.available_shares,
                'is_active': True
            }
        )

        if not created:
            pool_listing.is_active = True
            pool_listing.available_shares = group_listing.available_shares
            pool_listing.save(update_fields=['is_active', 'available_shares'])

        animal.orderitem_set.filter(listing_section='adahi_group').update(listing_section='adahi_pool')

        group_listing.delete()
        group.delete()

        return Response({"detail": "تم تحويل المجموعة إلى مسبح عام بنجاح."})

class HomeAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        try:
            limit = int(request.query_params.get('limit', 8))
            if limit > 50:
                limit = 50
        except (ValueError, TypeError):
            limit = 8

        latest_weight_subquery = WeightLog.objects.filter(animal=OuterRef('pk')).order_by('-date').values('weight_kg')[:1]

        base_qs = Animal.objects.filter(status='available').select_related('category', 'source_farm').annotate(
            annotated_current_weight=Subquery(latest_weight_subquery),
            annotated_price_after_discount=Case(
                When(is_offer=True, discount_percent__gt=0, then=F('price_egp') * (1 - F('discount_percent') / 100)),
                default=F('price_egp'),
                output_field=DecimalField()
            )
        )

        base_qs = base_qs.filter(is_hidden_from_store=False, has_defect=False)

        latest_animals_qs = base_qs.order_by('-created_at')[:limit]
        on_offer_qs = base_qs.filter(is_offer=True).order_by('-created_at')[:limit]
        cats_qs = Category.objects.all().order_by('name_ar')

        return Response({
            'latest_animals': AnimalHomeSerializer(latest_animals_qs, many=True, context={'request': request}).data,
            'on_offer_animals': AnimalHomeSerializer(on_offer_qs, many=True, context={'request': request}).data,
            'categories': CategoryHomeSerializer(cats_qs, many=True, context={'request': request}).data,
        })

class AvailableDatesView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        option = request.data.get("option")
        items = request.data.get("items", [])

        setting = DeliverySetting.objects.first()
        if not setting or option not in ["to_home", "pickup"]:
            return Response([], status=200)

        has_slaughter = any(item.get('services', {}).get('slaughter', False) for item in items)

        prep_days = setting.slaughter_preparation_days if has_slaughter else setting.preparation_days

        today = date.today()
        start_day = today + timedelta(days=prep_days)
        is_delivery = option in ["to_home", "delivery"]

        days_ahead = setting.delivery_days_ahead if is_delivery else setting.pickup_days_ahead
        allowed_days = setting.delivery_days if is_delivery else setting.pickup_days

        base_dates = []
        for i in range(days_ahead):
            day = start_day + timedelta(days=i)
            if day.strftime("%A") in allowed_days:
                base_dates.append(day.strftime("%Y-%m-%d"))

        if option == "pickup":
            return Response(base_dates)

        op_settings = OperationSettings.load()
        tolerance = op_settings.delivery_limit_tolerance

        requested_cats = {}
        for item in items:
            cat_id = item.get('category_id')
            share_qty = Decimal(str(item.get('share_quantity', 1)))
            max_shares = Decimal(str(item.get('max_shares', 1)))
            if not cat_id:
                continue

            ratio = share_qty / max_shares
            if cat_id not in requested_cats:
                cat = Category.objects.filter(id=cat_id).first()
                limit = cat.daily_delivery_limit if cat else 0
                requested_cats[cat_id] = {'limit': limit, 'count': Decimal('0')}

            requested_cats[cat_id]['count'] += ratio

        valid_dates = []
        for date_str in base_dates:
            can_deliver = True
            for cat_id, data in requested_cats.items():
                limit = data['limit']
                if limit == 0:
                    continue

                existing_orders = OrderItem.objects.filter(
                    order__delivery_date=date_str,
                    order__delivery_type='delivery',
                    order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment'],
                    animal__category_id=cat_id
                ).annotate(
                    max_s=Case(
                        When(animal__category__default_max_shares__gt=0, then=F('animal__category__default_max_shares')),
                        default=Value(1),
                        output_field=DecimalField()
                    ),
                    ratio=ExpressionWrapper(
                        F('share_quantity') * 1.0 / F('max_s'),
                        output_field=DecimalField()
                    )
                ).aggregate(total=Sum('ratio'))['total'] or Decimal('0')

                if float(existing_orders) + float(data['count']) > (limit + tolerance):
                    can_deliver = False
                    break

            if can_deliver:
                valid_dates.append(date_str)

        return Response(valid_dates)

class DeliveryAreaListView(ListAPIView):
    queryset = DeliveryArea.objects.filter(is_active=True).order_by('governorate__name_ar')
    serializer_class = DeliveryAreaSerializer
    permission_classes = [AllowAny]

class DeliverySettingDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        setting = DeliverySetting.objects.first()
        if not setting:
            return Response({"detail": "Delivery settings not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = DeliverySettingSerializer(setting)
        return Response(serializer.data)

class ClientServiceQuestionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        questions = ClientServiceQuestion.objects.filter(is_active=True, show_to_client=True).prefetch_related('options')
        serializer = ClientServiceQuestionSerializer(questions, many=True)
        data = serializer.data
        for q in data:
            q['options'] = [opt for opt in q['options'] if opt['is_active']]
        return Response(data)

class ServicePriceSettingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ServicePriceSetting.objects.filter(is_active=True).order_by('name')
    serializer_class = ServicePriceSettingSerializer
    permission_classes = [AllowAny]

@api_view(['POST'])
@permission_classes([AllowAny])
def calculate_price_preview(request):
    animal_id = request.data.get('animal_id')
    services = request.data.get('services', {})
    share_qty = int(request.data.get('share_quantity', 1))

    try:
        animal = Animal.objects.get(pk=animal_id, status='available', is_hidden_from_store=False)
        user = request.user if request.user.is_authenticated and isinstance(request.user, CustomerUser) else None

        calculation = PricingService.calculate_item_price(
            animal=animal,
            share_qty=share_qty,
            services=services,
            user=user
        )
        return Response(calculation)
    except Animal.DoesNotExist:
        return Response({'error': 'Animal not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

class ReorderImagesAPIView(APIView):
    permission_classes = [IsManagementUser]

    def post(self, request, animal_unique_id):
        order_data = request.data.get('order_data', [])
        if not isinstance(order_data, list):
            return Response({'detail': 'تنسيق البيانات غير صالح'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                for item in order_data:
                    img_id = item.get('id')
                    new_order = item.get('order')
                    if img_id is not None and new_order is not None:
                        AnimalImage.objects.filter(
                            id=img_id,
                            animal__unique_id=animal_unique_id
                        ).update(order=new_order)
            return Response({'status': 'success'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
def qr_code_redirect_view(request, unique_id):
    get_object_or_404(Animal, unique_id=unique_id)
    frontend_url = f"http://localhost:5173/animal/{unique_id}"
    return HttpResponseRedirect(redirect_to=frontend_url)
