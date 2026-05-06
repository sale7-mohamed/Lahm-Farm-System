# management/views.py

from accounts.models import User as CustomerUser, Address
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Sum, Q, functions, F, OuterRef, Subquery, Avg, ExpressionWrapper, DurationField, DecimalField, Case, When, Value, IntegerField
from django.db.models.functions import Floor, TruncMonth, TruncDate
from django.utils import timezone
from datetime import date, timedelta, datetime
from dateutil.relativedelta import relativedelta as rd
from rest_framework.permissions import AllowAny, IsAuthenticated
from orders.models import Order, OrderItem, SpecialRequest, Vehicle, Shipment
from orders.serializers import SpecialRequestSerializer, VehicleSerializer, ShipmentSerializer
from .services import calculate_feed_depletion_forecast, calculate_net_salary
from orders.services import PricingService
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError, AuthenticationFailed
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from livestock.models import Animal, AnimalImage, DeliverySetting, ServicePriceSetting, AnimalListing, DeliveryArea
from decimal import Decimal, InvalidOperation
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .permissions import HasPermission, IsManagementUser, CanViewDashboard
from .permissions_engine import get_effective_access, get_approver_for_module
from notifications.utils import send_notification, send_admin_notification
from .models import (
    Employee, FarmDepartment, EmployeeRole, InventoryItem,
    HealthLog, FeedingLog, PurchaseOrder, InventoryLot,
    StockMovement, Payroll, PayrollEntry, ApprovalRequest, WeightLog,
    Supplier, SupplierPayment, RolePermission,
    ChatRoom, ChatMessage, PasswordChangeLog, SalaryChangeLog, DiscountLog, EmployeeStatusLog,
    AttendanceLog, JobOpening, JobApplication, ContactMessage, CustomerCallLog, DocumentArchive,
    ModuleAccessRule, ApprovalRouting, AccessLevel, SystemModule,
    CustomerNoteLog, CustomerSuspensionLog
)
from payments.models import Payment
import requests
from management.serializers import OperationSettingsSerializer
from accounting.models import Account, JournalEntry
from livestock.serializers import AnimalImageSerializer, DeliverySettingSerializer, ServicePriceSettingSerializer, AnimalCreateSerializer
from livestock.views import AnimalViewSet as BaseAnimalViewSet
from accounts.serializers import DashboardCustomerSerializer
from .serializers import (
    AnimalProfileSerializer, EmployeeSerializer, EmployeeCreationSerializer,
    EmployeeRoleSerializer, FarmDepartmentSerializer,
    PermissionSerializer, InventoryItemSerializer, WeightLogCreateSerializer,
    HealthLogCreateSerializer, FeedingLogCreateSerializer, PurchaseOrderSerializer,
    PayrollSerializer, PayrollCreateSerializer, PayrollEntryCreateSerializer,
    ApprovalRequestSerializer,
    ManagementOrderSerializer, OrderStatusUpdateSerializer,
    EmployeeTokenObtainPairSerializer,
    SupplierSerializer, CustomerLookupSerializer,
    OrderLedgerSerializer, SimplePermissionSerializer,
    EmployeePermissionUpdateSerializer,
    ChatRoomSerializer, ChatMessageSerializer,
    ManagementAddressSerializer, ChangePasswordSerializer,
    GlobalDiscountSettingsSerializer, DiscountLogSerializer,
    AttendanceLogSerializer, StockMovementCreateSerializer,
    JobOpeningSerializer, JobApplicationSerializer, ManagementDeliveryAreaSerializer,
    ContactMessageSerializer, CustomerCallLogSerializer, DocumentArchiveSerializer,
    SimpleEmployeeSerializer
)
from .reporting_services import calculate_fcr_for_animal, calculate_animal_profitability
from .utils import normalize_phone
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from core.models import GlobalDiscountSettings, OperationSettings
from django.shortcuts import get_object_or_404
import random
from messaging.services import MessagingService

from notifications.models import Notification
from notifications.serializers import NotificationSerializer
from messaging.models import MessageLog
from messaging.serializers import MessageLogSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils.html import escape
import logging
logger = logging.getLogger(__name__)

class IsSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_superuser

class StaffLoginAPIView(TokenObtainPairView):
    serializer_class = EmployeeTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        mutable_data = request.data.copy()
        if 'username' in mutable_data:
            mutable_data['phone'] = mutable_data.pop('username')
        serializer = self.get_serializer(data=mutable_data)

        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed as e:
            return Response({"detail": str(e.detail)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            return Response({"detail": "بيانات الدخول غير صحيحة أو الوقت غير مسموح."}, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.user
        session_minutes = user.get_effective_session_duration()

        permissions_data = []
        if user.is_superuser:
            permissions_data = ["superuser"]
        else:
            user_perms = user.user_permissions.all()
            role_perms_through = user.role.rolepermission_set.filter(state='ALLOW').select_related('permission__content_type') if user.role else RolePermission.objects.none()
            role_perms = [rp.permission for rp in role_perms_through]
            department_perms = user.department.permissions.all() if user.department else Permission.objects.none()
            combined_perms = list(user_perms) + list(role_perms) + list(department_perms)
            unique_perms = list(set(combined_perms))
            permissions_data = [f"{p.content_type.app_label}.{p.codename}" for p in unique_perms]

        response_data = serializer.validated_data
        response_data['user_info'] = EmployeeSerializer(user).data
        response_data['permissions'] = permissions_data
        response_data['session_duration'] = session_minutes

        return Response(response_data, status=status.HTTP_200_OK)

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsManagementUser]

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        supplier = self.get_object()
        animals = supplier.animal_set.all().values(
            'code', 'purchase_price', 'created_at', 'status'
        ).order_by('-created_at')

        purchase_orders = supplier.purchaseorder_set.filter(status='received').annotate(
            total_cost=Sum(F('items__quantity') * F('items__unit_price'), output_field=DecimalField())
        ).values('id', 'created_at', 'total_cost', 'status').order_by('-created_at')

        payments_data = []
        for payment in supplier.payments.all().order_by('-date'):
            payments_data.append({
                'id': payment.id,
                'amount': payment.amount,
                'date': payment.date,
                'notes': payment.notes,
                'recorded_by__full_name': payment.recorded_by.full_name if payment.recorded_by else '',
                'receipt_image': request.build_absolute_uri(payment.receipt_image.url) if payment.receipt_image else None
            })

        return Response({
            'animals': animals,
            'payments': payments_data,
            'purchase_orders': purchase_orders
        })

    @action(detail=True, methods=['post'], url_path='add-payment')
    def add_payment(self, request, pk=None):
        supplier = self.get_object()
        amount = request.data.get('amount')
        notes = request.data.get('notes', '')
        receipt_image = request.FILES.get('receipt_image')

        if not amount or float(amount) <= 0:
            return Response({'detail': 'مبلغ غير صالح'}, status=status.HTTP_400_BAD_REQUEST)

        if receipt_image:
            if receipt_image.size > 5 * 1024 * 1024:
                return Response({'detail': 'حجم الصورة كبير جداً (حد أقصى 5 ميجابايت)'}, status=status.HTTP_400_BAD_REQUEST)
            allowed_types = ['image/jpeg', 'image/png', 'image/gif']
            if receipt_image.content_type not in allowed_types:
                return Response({'detail': 'نوع الملف غير مدعوم (يُسمح فقط بالصور)'}, status=status.HTTP_400_BAD_REQUEST)

        SupplierPayment.objects.create(
            supplier=supplier,
            amount=amount,
            notes=notes,
            recorded_by=request.user,
            receipt_image=receipt_image
        )
        return Response({'detail': 'تم تسجيل الدفعة بنجاح'})

class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.select_related('employee').prefetch_related('entries').order_by('-year', '-month')
    serializer_class = PayrollSerializer
    permission_classes = [IsManagementUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'year', 'month', 'is_paid']

    def get_serializer_class(self):
        if self.action == 'create':
            return PayrollCreateSerializer
        return PayrollSerializer

    def perform_create(self, serializer):
        payroll = serializer.save()
        employee = payroll.employee
        if employee.base_salary and employee.base_salary > 0:
            PayrollEntry.objects.create(
                payroll=payroll,
                entry_type='base_salary',
                description='الراتب الأساسي',
                amount=employee.base_salary
            )
            calculate_net_salary(payroll)

    @action(detail=False, methods=['get'], url_path='my-latest')
    def my_latest_payroll(self, request):
        employee = request.user
        latest_payroll = Payroll.objects.filter(employee=employee).order_by('-year', '-month').first()
        if not latest_payroll:
            return Response({}, status=status.HTTP_200_OK)
        serializer = self.get_serializer(latest_payroll)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        access = get_effective_access(request.user, SystemModule.HR)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لحذف الرواتب.")

        instance = self.get_object()

        if access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.HR)
            if not approver:
                raise PermissionDenied("لا يوجد مدير متاح للموافقة.")

            ApprovalRequest.objects.create(
                requester=request.user, approver=approver, action_type='delete_payroll',
                target_module=SystemModule.HR, target_object_id=instance.id,
                details={'employee_name': instance.employee.full_name, 'month': instance.month, 'year': instance.year},
                status='pending'
            )
            return Response({"detail": "تم إرسال طلب الحذف للمدير للموافقة."}, status=200)

        instance.delete()
        return Response({"detail": "تم حذف مسير الراتب بنجاح."}, status=200)

    @action(detail=True, methods=['post'], url_path='add-entry')
    def add_entry(self, request, pk=None):
        payroll = self.get_object()
        serializer = PayrollEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        if not validated_data.get('description'):
            entry_type_display = dict(PayrollEntry.ENTRY_TYPES).get(validated_data['entry_type'])
            validated_data['description'] = entry_type_display
        PayrollEntry.objects.create(payroll=payroll, **validated_data)
        calculate_net_salary(payroll)
        return Response(PayrollSerializer(payroll).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='mark-as-paid')
    def mark_as_paid(self, request, pk=None):
        payroll = self.get_object()
        if payroll.is_paid:
            return Response({"error": "هذا الراتب تم دفعه بالفعل."}, status=status.HTTP_400_BAD_REQUEST)
        calculate_net_salary(payroll)
        payroll.refresh_from_db()
        payroll.is_paid = True
        payroll.paid_date = date.today()
        payroll.save(update_fields=['is_paid', 'paid_date', 'net_salary'])
        return Response({"status": "تم تحديد الراتب كمدفوع وتسجيل القيد المحاسبي."})

    @action(detail=True, methods=['post'], url_path='reverse-payment')
    def reverse_payment(self, request, pk=None):
        payroll = self.get_object()
        if not payroll.is_paid:
            return Response({"error": "هذا الراتب غير مدفوع أصلاً."}, status=status.HTTP_400_BAD_REQUEST)
        payroll.is_paid = False
        payroll.paid_date = None
        payroll.save(update_fields=['is_paid', 'paid_date'])
        return Response({"status": "تم إلغاء عملية الدفع وحذف القيد المحاسبي."})

class FarmDepartmentViewSet(viewsets.ModelViewSet):
    queryset = FarmDepartment.objects.all().order_by('id')
    serializer_class = FarmDepartmentSerializer
    permission_classes = [IsManagementUser]

    @action(detail=False, methods=['get', 'post'], url_path='chat-permissions')
    def chat_permissions(self, request):
        if not request.user.is_superuser:
            return Response({"detail": "غير مصرح"}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            depts = FarmDepartment.objects.all()
            data = []
            for d in depts:
                data.append({
                    'id': d.id,
                    'name': d.name,
                    'can_communicate_with': list(d.can_communicate_with.values_list('id', flat=True))
                })
            return Response(data)

        elif request.method == 'POST':
            permissions_data = request.data.get('permissions', [])
            with transaction.atomic():
                for item in permissions_data:
                    dept = FarmDepartment.objects.get(id=item['id'])
                    dept.can_communicate_with.set(item['can_communicate_with'])
            return Response({"detail": "تم تحديث صلاحيات الشات بنجاح"})

class EmployeeRoleViewSet(viewsets.ModelViewSet):
    queryset = EmployeeRole.objects.annotate(
        employee_count=Count('employee')
    ).select_related('department').prefetch_related('rolepermission_set__permission').order_by('id')
    serializer_class = EmployeeRoleSerializer
    permission_classes = [IsSuperuser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['department']

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        permissions_state_data = request.data.get('permissions_state')
        if permissions_state_data is not None:
            if not isinstance(permissions_state_data, dict):
                raise ValidationError("permissions_state must be an object.")
            instance.rolepermission_set.all().delete()
            for perm_id_str, state in permissions_state_data.items():
                if state in ['ALLOW', 'REQUIRE_APPROVAL']:
                    try:
                        perm_id = int(perm_id_str)
                        permission = Permission.objects.get(pk=perm_id)
                        RolePermission.objects.create(role=instance, permission=permission, state=state)
                    except (Permission.DoesNotExist, ValueError):
                        continue
        final_serializer = self.get_serializer(instance)
        return Response(final_serializer.data)

class AnimalProfileAPIView(generics.RetrieveAPIView):
    queryset = Animal.objects.select_related('category', 'mother', 'father').prefetch_related('health_logs__vet', 'feeding_logs__item', 'feeding_logs__user', 'weight_logs', 'images').all()
    serializer_class = AnimalProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'unique_id'

class AnimalViewSet(BaseAnimalViewSet):
    permission_classes = [IsManagementUser]
    lookup_field = 'unique_id'

    def get_serializer_class(self):
        if self.action == 'create':
            return AnimalCreateSerializer
        return super().get_serializer_class()

    @action(detail=True, methods=['post'], url_path='toggle-share-listing', permission_classes=[IsManagementUser])
    def toggle_share_listing(self, request, unique_id=None, pk=None):
        animal = self.get_object()
        action_type = request.data.get('action', 'enable')
        max_shares = int(request.data.get('max_shares', 0))

        if animal.status == 'sold':
            return Response({"detail": "لا يمكن تعديل إعدادات حيوان تم بيعه."}, status=400)
        if animal.is_hidden_from_store:
            return Response({"detail": "لا يمكن إنشاء مجموعة مشاركة لحيوان مخفي من المتجر."}, status=400)
        if action_type == 'enable' and max_shares < 2:
            return Response({"detail": "عدد الأسهم يجب أن يكون 2 على الأقل."}, status=400)
        if action_type == 'enable' and max_shares > 100:
            return Response({"detail": "عدد الأسهم يجب ألا يتجاوز 100."}, status=400)

        with transaction.atomic():
            if action_type == 'enable':
                if not animal.is_shareable:
                    animal.is_shareable = True
                    animal.save(update_fields=['is_shareable'])

                listing, created = AnimalListing.objects.select_for_update().get_or_create(
                    animal=animal,
                    pipeline='G',
                    section='shares',
                    defaults={
                        'price': animal.price_after_discount,
                        'total_shares': max_shares,
                        'available_shares': max_shares,
                        'is_active': True
                    }
                )

                if not created:
                    listing.price = animal.price_after_discount
                    listing.total_shares = max_shares
                    listing.available_shares = max_shares
                    listing.is_active = True
                    listing.save()

                return Response({
                    "status": "enabled",
                    "message": f"تم تفعيل المشاركة العامة للحيوان بـ {max_shares} سهم.",
                    "listing_id": listing.id,
                    "animal_code": animal.code,
                    "total_shares": listing.total_shares,
                    "available_shares": listing.available_shares
                })

            elif action_type == 'disable':
                if animal.is_shareable:
                    animal.is_shareable = False
                    animal.save(update_fields=['is_shareable'])

                listing = AnimalListing.objects.filter(
                    animal=animal,
                    pipeline='G',
                    section='shares'
                ).first()

                if listing and listing.is_active:
                    listing.is_active = False
                    listing.save(update_fields=['is_active'])

                return Response({
                    "status": "disabled",
                    "message": "تم تعطيل المشاركة العامة للحيوان."
                })

    @action(detail=True, methods=['post'], url_path='toggle-adahi-pool', permission_classes=[IsManagementUser])
    def toggle_pool_status(self, request, unique_id=None, pk=None):
        animal = self.get_object()

        if animal.status == 'sold':
            return Response({"detail": "لا يمكن تعديل إعدادات حيوان تم بيعه."}, status=400)

        if not animal.is_sacrifice_valid_now:
            return Response({"detail": "الحيوان غير صالح للأضحية حسب الشروط الشرعية."}, status=400)

        if animal.category.logic_type not in ['cow', 'camel']:
            return Response({"detail": "فقط البقر والجمال يمكن إضافتها لمسبح الأضاحي."}, status=400)

        has_real_sales = animal.orderitem_set.exists() or animal.reservations.filter(status__in=['pending', 'confirmed']).exists()

        with transaction.atomic():
            existing_pool = AnimalListing.objects.filter(
                animal=animal,
                pipeline='S',
                section='adahi_pool',
                is_active=True
            ).first()

            if existing_pool:
                existing_pool.is_active = False
                existing_pool.save()

                animal.is_adahi_pool = False
                if not has_real_sales:
                    animal.is_adahi = False

                animal.save()

                return Response({
                    "status": "removed",
                    "is_adahi_pool": False,
                    "message": "تم إزالة الحيوان من مسبح الأضاحي."
                })
            else:
                pool_listing, created = AnimalListing.objects.get_or_create(
                    animal=animal,
                    pipeline='S',
                    section='adahi_pool',
                    defaults={
                        'price': animal.price_after_discount,
                        'total_shares': 7,
                        'available_shares': 7,
                        'is_active': True
                    }
                )

                if not created and not pool_listing.is_active:
                    pool_listing.is_active = True
                    pool_listing.save()

                animal.is_adahi_pool = True
                animal.is_adahi = True
                animal.save()

                return Response({
                    "status": "added",
                    "is_adahi_pool": True,
                    "message": "تم إضافة الحيوان لمسبح الأضاحي بـ 7 أسهم."
                })

    @action(detail=True, methods=['post'], url_path='mark-supplier-sold')
    @transaction.atomic
    def mark_supplier_sold(self, request, unique_id=None, pk=None):
        animal = self.get_object()

        if not animal.source_farm:
            return Response({"detail": "هذا الإجراء متاح فقط للمواشي من مزارع خارجية."}, status=400)

        SupplierPayment.objects.create(
            supplier=animal.source_farm,
            amount=0,
            notes=f"🚨 تنبيه إداري: المورد باع الحيوان #{animal.code} .    ({animal.purchase_price} .)     .",
            recorded_by=request.user
        )

        animal.status = 'lost'
        animal.is_hidden_from_store = True
        animal.internal_notes = (animal.internal_notes or '') + "\n[تحذير]: تم الإبلاغ أن المورد باع هذا الحيوان خارج المنصة."
        animal.save(update_fields=['status', 'is_hidden_from_store', 'internal_notes'])

        from livestock.models import AnimalListing
        AnimalListing.objects.filter(animal=animal).update(is_active=False)

        affected_orders = Order.objects.filter(
            items__animal=animal,
            status__in=['pending', 'confirmed', 'processing']
        ).distinct()

        for order in affected_orders:
            order.status = 'requires_action'
            order.notes = (order.notes or '') + f"\n[عاجل ⚠️]: أبلغ المورد ببيع الحيوان #{animal.code}  .    ."
            order.save(update_fields=['status', 'notes'])

        return Response({
            "detail": f"تم تسجيل الحيوان كمفقود وإسقاط ديونه ({animal.purchase_price} ج.م) من كشف حساب المورد. تم تحويل {affected_orders.count()} طلب عميل إلى (يتطلب تدخل)."
        })

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('department', 'role').prefetch_related(
        'status_logs',
        'user_permissions',
        'password_changes__changed_by__department',
        'salary_changes__changed_by'
    ).order_by('-id')

    permission_classes = [IsManagementUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['department', 'role', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return EmployeeCreationSerializer
        if self.action == 'partial_update' and 'user_permissions' in self.request.data:
            return EmployeePermissionUpdateSerializer
        if self.action == 'change_password':
            return ChangePasswordSerializer
        return EmployeeSerializer

    def perform_update(self, serializer):
        access = get_effective_access(self.request.user, SystemModule.HR)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لتعديل بيانات الموظفين.")

        if access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.HR)
            if not approver:
                raise PermissionDenied("لم يتم تعيين مسؤول للموافقات في قسم الموارد البشرية.")

            ApprovalRequest.objects.create(
                requester=self.request.user,
                approver=approver,
                action_type='update_employee',
                target_module=SystemModule.HR,
                target_object_id=serializer.instance.id,
                details={'employee_name': serializer.instance.full_name},
                pending_data=self.request.data,
                status='pending'
            )
            return

        instance = serializer.instance
        old_salary = instance.base_salary
        new_salary_validated = serializer.validated_data.get('base_salary')
        updated_instance = serializer.save()
        if new_salary_validated is not None:
            new_salary = Decimal(new_salary_validated)
            if new_salary != old_salary:
                SalaryChangeLog.objects.create(
                    employee=updated_instance, changed_by=self.request.user,
                    old_salary=old_salary, new_salary=new_salary
                )

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        access = get_effective_access(self.request.user, SystemModule.HR)
        if access == AccessLevel.REQUIRE_APPROVAL:
            return Response({"detail": "تم إرسال طلب التعديل للمدير للموافقة."}, status=200)
        return response

    def destroy(self, request, *args, **kwargs):
        access = get_effective_access(request.user, SystemModule.HR)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لحذف الموظفين.")

        instance = self.get_object()

        if access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.HR)
            if not approver:
                raise PermissionDenied("لا يوجد مدير متاح للموافقة على طلب الحذف.")

            ApprovalRequest.objects.create(
                requester=request.user, approver=approver, action_type='delete_employee',
                target_module=SystemModule.HR, target_object_id=instance.id,
                details={'employee_name': instance.full_name}, status='pending'
            )
            return Response({"detail": "تم إرسال طلب الحذف للمدير للموافقة."}, status=200)

        instance.delete()
        return Response({"detail": "تم حذف الموظف بنجاح."}, status=200)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        employee = self.get_object()
        reason = request.data.get('reason', 'تم إلغاء التفعيل من قبل الإدارة.')
        employee.is_active = False
        employee.deactivation_reason = reason
        employee.save(update_fields=['is_active', 'deactivation_reason'])
        return Response({'status': 'تم إلغاء تنشيط الموظف بنجاح.'})

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = True
        employee.deactivation_reason = None
        employee.save(update_fields=['is_active', 'deactivation_reason'])
        return Response({'status': 'تم تنشيط الموظف'})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        return ip

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        employee_instance = self.get_object()
        if request.user.id != employee_instance.id and not request.user.is_superuser:
            raise PermissionDenied("ليس لديك الصلاحية لتغيير كلمة مرور هذا المستخدم.")
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            new_password = serializer.validated_data['new_password']
            employee_instance.set_password(new_password)

            employee_instance.last_password_change = timezone.now()
            employee_instance.save(update_fields=['password', 'last_password_change'])

            ip_address = self.get_client_ip(request)
            PasswordChangeLog.objects.create(
                employee=employee_instance,
                changed_by=request.user,
                ip_address=ip_address,
                mac_address=None,
                notes=serializer.validated_data.get('notes', 'تغيير من لوحة التحكم')
            )

            refreshed_employee = self.get_queryset().get(pk=employee_instance.pk)

            response_serializer = EmployeeSerializer(refreshed_employee)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle-chat-block')
    def toggle_chat_block(self, request, pk=None):
        if not request.user.is_superuser:
            raise PermissionDenied("فقط الإدارة العليا يمكنها حظر الموظفين من الشات.")
        employee = self.get_object()
        employee.is_chat_blocked = not employee.is_chat_blocked
        employee.save(update_fields=['is_chat_blocked'])
        status_msg = "تم منعه من الإرسال" if employee.is_chat_blocked else "تم السماح له بالإرسال"
        return Response({"detail": f"تم تحديث حالة {employee.full_name}: {status_msg}", "is_chat_blocked": employee.is_chat_blocked})

    @action(detail=False, methods=['get'], url_path='chat-departments')
    def chat_departments(self, request):
        user = request.user

        if user.is_superuser:
            depts = FarmDepartment.objects.filter(is_active=True).prefetch_related('employee_set')
        else:
            allowed_ids = []
            if user.department:
                allowed_ids = list(user.department.can_communicate_with.values_list('id', flat=True))
                allowed_ids.append(user.department.id)

            user_rooms = user.chat_rooms.filter(room_type='DIRECT')
            active_chats_users = Employee.objects.filter(
                chat_rooms__in=user_rooms
            ).exclude(id=user.id)

            active_dept_ids = list(active_chats_users.values_list('department_id', flat=True))

            final_ids = set(allowed_ids + active_dept_ids)
            final_ids = [d for d in final_ids if d is not None]

            depts = FarmDepartment.objects.filter(
                id__in=final_ids,
                is_active=True
            ).prefetch_related('employee_set')

        result = []
        for d in depts:
            emps = d.employee_set.filter(is_active=True).exclude(id=user.id)
            if emps.exists() or user.is_superuser or (user.department and d.id == user.department.id):
                result.append({
                    'id': d.id,
                    'name': d.name,
                    'can_communicate_with': list(d.can_communicate_with.values_list('id', flat=True)),
                    'employees': [{
                        'id': e.id,
                        'full_name': e.full_name,
                        'role_name': e.role.name if e.role else 'موظف',
                        'department_name': d.name,
                        'department': e.department_id,
                        'allowed_chat_users': list(e.allowed_chat_users.values_list('id', flat=True))
                    } for e in emps]
                })

        return Response(result)

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """
                (   )
        """
        user = request.user
        serializer = self.get_serializer(user)
        module_access = get_all_user_access(user)

        permissions_data = []
        if user.is_superuser:
            permissions_data = ["superuser"]
        else:
            user_perms = user.user_permissions.all()
            role_perms_through = user.role.rolepermission_set.filter(state='ALLOW').select_related('permission__content_type') if user.role else RolePermission.objects.none()
            role_perms = [rp.permission for rp in role_perms_through]
            department_perms = user.department.permissions.all() if user.department else Permission.objects.none()
            combined_perms = list(user_perms) + list(role_perms) + list(department_perms)
            unique_perms = list(set(combined_perms))
            permissions_data = [f"{p.content_type.app_label}.{p.codename}" for p in unique_perms]

        return Response({
            'user_info': serializer.data,
            'module_access': module_access,
            'permissions': permissions_data,
            'is_superuser': user.is_superuser
        })

class AnimalImageViewSet(viewsets.ModelViewSet):
    serializer_class = AnimalImageSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        return AnimalImage.objects.filter(animal__unique_id=self.kwargs['animal_unique_id'])

    def perform_create(self, serializer):
        animal = generics.get_object_or_404(Animal, unique_id=self.kwargs['animal_unique_id'])
        serializer.save(animal=animal)

class ManagementOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsManagementUser]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'user', 'has_slaughter_service']
    search_fields = ['id', 'user__full_name', 'user__phone', 'items__animal__code']

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return OrderStatusUpdateSerializer
        return ManagementOrderSerializer

    def get_queryset(self):
        qs = Order.objects.all().select_related(
            'user', 'created_by_employee', 'delivery_address'
        ).prefetch_related('items__animal', 'documents')

        if self.action == 'list':
            qs = qs.exclude(source='b2b')

        order_type = self.request.query_params.get('order_type')
        if order_type == 'pos':
            qs = qs.filter(source='on_farm')
        elif order_type == 'store':
            qs = qs.filter(source='online_store').exclude(
                items__listing_section__in=['adahi_pool', 'adahi_group', 'adahi_full', 'shares']
            )
        elif order_type == 'adahi':
            qs = qs.filter(source='online_store', items__listing_section__in=['adahi_pool', 'adahi_group', 'adahi_full', 'shares'])

        late_paid = self.request.query_params.get('late_paid')
        if late_paid == 'true':
            qs = qs.filter(status='canceled', deposit_total__gt=0)

        requires_action = self.request.query_params.get('requires_action')
        if requires_action == 'true':
            qs = qs.filter(status='requires_action')

        delivery_date = self.request.query_params.get('delivery_date')
        if delivery_date:
            try:
                valid_date = datetime.strptime(delivery_date, '%Y-%m-%d').date()
                qs = qs.filter(delivery_date=valid_date)
            except ValueError:
                pass

        ordering = self.request.query_params.get('ordering')
        today = timezone.localtime(timezone.now()).date()

        if ordering == 'delivery_date':
            qs = qs.annotate(
                date_priority=Case(
                    When(delivery_date__isnull=True, then=Value(2)),
                    When(delivery_date__lt=today, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            ).order_by('date_priority', 'delivery_date', '-created_at')
        elif ordering == '-delivery_date':
            qs = qs.order_by('-delivery_date', '-created_at')
        elif ordering:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('-created_at')

        return qs.distinct()

    def perform_update(self, serializer):
        access = get_effective_access(self.request.user, SystemModule.ORDERS)
        if access in[AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لتعديل الطلبات.")

        old_status = serializer.instance.status
        old_delivery_date = serializer.instance.delivery_date

        new_status = serializer.validated_data.get('status', old_status)
        new_delivery_date = serializer.validated_data.get('delivery_date', old_delivery_date)

        instance = serializer.save()

        if old_delivery_date != new_delivery_date and new_delivery_date:
            try:
                from notifications.utils import send_notification
                send_notification(
                    user=instance.user,
                    title=f"تحديث موعد الاستلام للطلب #{instance.id}",
                    message=f"تم تأكيد موعد الاستلام لطلبك ليكون بتاريخ {new_delivery_date}. يرجى المتابعة.",
                    category="order"
                )
            except Exception as e:
                logger.error(f"Failed to send delivery date notification: {e}")

        if old_status != new_status:
            time_now = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
            status_ar = instance.get_status_display()
            log_entry = f"\n[نظام - {time_now}]: تم تغيير حالة الطلب إلى ({status_ar})."

            instance.notes = (instance.notes or '') + log_entry
            instance.save(update_fields=['notes'])

            if new_status == 'canceled' and old_status != 'canceled':
                from livestock.models import AnimalListing, AdahiGroup
                for item in instance.items.all():
                    animal = item.animal
                    services = item.selected_services or {}

                    if services.get('is_group_creator') and item.listing_section == 'adahi_group':
                        AdahiGroup.objects.filter(listing__animal=animal, created_by=instance.user).delete()
                        AnimalListing.objects.filter(animal=animal, section='adahi_group').update(is_active=False)
                    elif item.listing_section:
                        listing = AnimalListing.objects.select_for_update().filter(
                            animal=animal, pipeline=item.pipeline, section=item.listing_section
                        ).first()
                        if listing:
                            listing.available_shares += item.share_quantity
                            listing.is_active = True
                            listing.save(update_fields=["available_shares", "is_active"])

                    if not animal.has_partial_sales():
                        animal.status = 'available'
                        animal.first_sale_at = None
                        animal.save(update_fields=['status', 'first_sale_at'])

                        paused_listings = AnimalListing.objects.filter(animal=animal, paused_due_to_order=True)
                        for pl in paused_listings:
                            pl.is_active = True
                            pl.paused_due_to_order = False
                            if pl.available_shares == 0:
                                pl.available_shares = pl.total_shares
                            pl.save(update_fields=['is_active', 'paused_due_to_order', 'available_shares'])

            if new_status in ['delivered', 'completed']:
                for item in instance.items.all():
                    if item.animal.status == 'reserved':
                        item.animal.status = 'sold'
                        item.animal.save(update_fields=['status'])

            if instance.source == 'b2b' and hasattr(instance, 'business_source') and instance.business_source:
                b_req = instance.business_source
                b_req.admin_notes = (b_req.admin_notes or '') + log_entry

                if new_status == 'canceled':
                    b_req.status = 'rejected'
                elif new_status in ['completed', 'delivered']:
                    b_req.status = 'fulfilled'
                elif new_status in ['processing', 'ready_for_shipment', 'out_for_delivery']:
                    b_req.status = 'paid'

                b_req.save(update_fields=['admin_notes', 'status'])

                if send_notification:
                    send_notification(
                        instance.user,
                        title=f"تحديث حالة طلب الشركات #{b_req.id}",
                        message=f"تم تحديث حالة طلبك إلى: {status_ar}",
                        category="business_request"
                    )

    @action(detail=True, methods=['post'], url_path='record-payment')
    @transaction.atomic
    def record_payment(self, request, pk=None):
        order = Order.objects.select_for_update().get(pk=self.get_object().pk)
        amount_str = request.data.get('amount', '0')
        payment_method = request.data.get('payment_method', 'cash')

        try:
            amount = Decimal(str(amount_str))
        except Exception:
            return Response({"detail": "صيغة المبلغ غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0 or amount > order.remaining_amount:
            return Response({"detail": "المبلغ غير صالح."}, status=status.HTTP_400_BAD_REQUEST)

        if payment_method == 'paymob_link':
            payment = Payment.objects.create(
                order=order, user=order.user,
                amount=amount,
                payment_method='paymob_link',
                status='pending',
                payment_type='initial' if order.deposit_total == 0 else 'remainder',
                recorded_by=request.user
            )
            try:
                from payments.services.paymob_service import PaymobService
                from messaging.services import MessagingService
                paymob = PaymobService()

                merchant_ref = f"{order.id}_{payment.id}"
                animal_codes =[item.animal.code for item in order.items.all() if item.animal]
                items_desc = f"مواشي: {', '.join(animal_codes)}" if animal_codes else f"دفع طلب #{order.id}"

                billing_data = {
                    "first_name": order.user.full_name or "Customer",
                    "phone_number": order.user.phone or "01000000000",
                    "email": order.user.email or "info@lahmfarm.com",
                }

                link_data = paymob.create_quick_link(amount, billing_data, merchant_ref, items_description=items_desc)
                payment.transaction_id = link_data["paymob_order_id"]
                payment.save()

                if order.user.phone:
                    first_name = order.user.full_name.split()[0] if order.user.full_name else "عميلنا"
                    sms_text = f"مرحباً {first_name}، لدفع مبلغ ({amount} ج.م) لطلبك رقم #{order.id}    : {link_data['payment_url']}"
                    MessagingService.send_message(phone=order.user.phone, content=sms_text, msg_type='AUTOMATED', user=request.user)
                return Response({"detail": "تم إنشاء رابط الدفع وإرساله للعميل في SMS بنجاح.", "status": order.status})
            except Exception as e:
                payment.status = 'failed'
                payment.save()
                return Response({"detail": "فشل إنشاء رابط الدفع."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"detail": "المبلغ يجب أن يكون أكبر من صفر."}, status=status.HTTP_400_BAD_REQUEST)
        if amount > order.remaining_amount:
            return Response({"detail": "المبلغ المدخل أكبر من المتبقي على العميل."}, status=status.HTTP_400_BAD_REQUEST)

        Payment.objects.create(
            order=order,
            user=order.user,
            amount=amount,
            payment_method=payment_method,
            status='completed',
            payment_type='initial' if order.deposit_total == 0 else 'remainder',
            transaction_id=f"MANUAL-{order.id}-{int(timezone.now().timestamp())}",
            recorded_by=request.user
        )
        order.recalc_totals(commit=True)
        return Response({
            "detail": "تم تسجيل الدفعة بنجاح.",
            "status": order.status,
            "remaining_amount": order.remaining_amount,
            "deposit_total": order.deposit_total
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-delivered-driver')
    @transaction.atomic
    def mark_delivered_driver(self, request, pk=None):
        order = self.get_object()
        cash_received = request.data.get('cash_received', 0)
        payment_method = request.data.get('payment_method', 'cash')
        receipt_image = request.FILES.get('receipt_image')
        delivery_photo = request.FILES.get('delivery_photo')

        if not receipt_image:
            return Response({"detail": "صورة إيصال الاستلام المُمضي مطلوبة."}, status=status.HTTP_400_BAD_REQUEST)

        order.signed_receipt_image = receipt_image
        if delivery_photo:
            order.delivery_photo = delivery_photo

        if cash_received > 0:
            Payment.objects.create(
                order=order,
                user=order.user,
                amount=cash_received,
                payment_method=payment_method,
                status='completed',
                payment_type='remainder',
                transaction_id=f"DRIVER-{order.id}-{int(timezone.now().timestamp())}",
                recorded_by=request.user
            )

        order.status = 'delivered'
        method_str = "ماكينة الدفع (POS)" if payment_method == 'pos' else "نقداً (كاش)"
        order.notes = (order.notes or '') + f"\n[السائق]: تم تحصيل {cash_received} ج.م عن طريق {method_str}."
        order.save()

        if receipt_image:
            DocumentArchive.objects.create(
                title=f"إيصال تسليم طلب #{order.id} - {order.user.full_name}",
                document_type='order_doc',
                file=order.signed_receipt_image,
                order=order,
                b2b_customer=order.user,
                uploaded_by=request.user
            )
        if delivery_photo:
            DocumentArchive.objects.create(
                title=f"صورة الماشية بالموقع طلب #{order.id} - {order.user.full_name}",
                document_type='order_doc',
                file=order.delivery_photo,
                order=order,
                b2b_customer=order.user,
                uploaded_by=request.user
            )

        order.recalc_totals(commit=True)

        if order.user.email and order.user.is_email_verified:
            try:
                subject = f"تم تسليم طلبك رقم #{order.id} "
                intro = "نتمنى أن تنال منتجاتنا إعجابكم. تم تسليم طلبكم بنجاح."
                html_content = render_to_string('emails/receipt_email.html', {
                    'name': order.user.full_name,
                    'order': order,
                    'intro_text': intro,
                    'site_url': 'https://lahmfarm.com'
                })
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=intro,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@lahmfarm.com'),
                    to=[order.user.email]
                )
                msg.attach_alternative(html_content, "text/html")
                msg.send(fail_silently=True)
            except Exception:
                pass

        return Response({"detail": "تم تأكيد التسليم ورفع الوثائق بنجاح."})

    @action(detail=True, methods=['post'], url_path='upload-slaughter-video')
    @transaction.atomic
    def upload_slaughter_video(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get('item_id')
        video_file = request.FILES.get('video')

        if not item_id or not video_file:
            return Response({"detail": "يجب إرسال الفيديو ومعرف العنصر"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = order.items.get(id=item_id)
            item.slaughter_video = video_file
            item.save()

            video_path = item.slaughter_video.path
            wm_text = [f"Order: #{order.id}", f"Animal: {item.animal.code}", "0 103 702 9909"]
            new_path = apply_video_watermark(video_path, wm_text)

            if new_path != video_path:
                os.remove(video_path)
                item.slaughter_video.name = new_path.split('media/')[-1]
                item.save()

            return Response({"detail": "تم رفع الفيديو بنجاح"})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='update-weight-price')
    @transaction.atomic
    def update_weight_price(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get('item_id')
        new_weight = request.data.get('new_weight')
        new_price = request.data.get('new_price')

        if not item_id or not new_weight or not new_price:
            return Response({"detail": "البيانات غير مكتملة."}, status=400)

        try:
            new_weight_dec = Decimal(str(new_weight))
            new_price_dec = Decimal(str(new_price))
        except:
            return Response({"detail": "صيغة الأرقام غير صحيحة."}, status=400)

        item = get_object_or_404(OrderItem, id=item_id, order=order)
        animal = item.animal

        old_price = item.price_per_item
        old_weight = animal.current_weight or 0

        item.actual_weight = new_weight_dec
        if not item.original_price:
            item.original_price = old_price
        item.price_per_item = new_price_dec
        item.save()

        animal.price_egp = new_price_dec

        time_now_full = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
        note_addition = f"\n✅ [{time_now_full}]: تم تحديث الميزان إلى {new_weight_dec} كجم، وتعديل السعر من {old_price} إلى {new_price_dec} ج.م."
        animal.internal_notes = (animal.internal_notes or '') + note_addition
        animal.save(update_fields=['price_egp', 'internal_notes'])

        WeightLog.objects.create(
            animal=animal,
            date=date.today(),
            weight_kg=new_weight_dec,
            recorded_by=request.user
        )

        order_note = f"\n⚖️ [إدارة الميزان - {time_now_full}]: تم تحديث الوزن الفعلي للحيوان #{animal.code}  {new_weight_dec}     {old_price} .  {new_price_dec} .."
        order.notes = (order.notes or '') + order_note
        order.save(update_fields=['notes'])

        fresh_order = Order.objects.prefetch_related('items').get(id=order.id)
        fresh_order.recalc_totals(commit=True)

        return Response({"detail": "تم تحديث الوزن وتعديل الفاتورة بنجاح."})

    @action(detail=True, methods=['post'], url_path='update-item-services')
    @transaction.atomic
    def update_item_services(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get('item_id')
        new_services = request.data.get('services', {})

        if not item_id:
            return Response({"detail": "البيانات غير مكتملة."}, status=400)

        item = get_object_or_404(OrderItem, id=item_id, order=order)
        animal = item.animal

        slaughter = new_services.get('slaughter', False)
        cutting = new_services.get('cutting', False)
        packaging = new_services.get('packaging', False)

        if not slaughter:
            cutting = False
            packaging = False
        if not cutting:
            packaging = False

        cat = animal.category
        current_services = item.selected_services or {}
        current_services['slaughter'] = slaughter
        current_services['cutting'] = cutting
        current_services['packaging'] = packaging

        if '_service_costs' not in current_services:
            current_services['_service_costs'] = {}

        current_services['_service_costs']['slaughter'] = str(cat.slaughter_price) if slaughter else '0.00'
        current_services['_service_costs']['cutting'] = str(cat.cutting_price) if cutting else '0.00'
        current_services['_service_costs']['packaging'] = str(cat.packaging_price) if packaging else '0.00'

        item.selected_services = current_services

        new_cost = Decimal('0.00')
        if slaughter:
            new_cost += cat.slaughter_price
        if cutting:
            new_cost += cat.cutting_price
        if packaging:
            new_cost += cat.packaging_price

        old_item_cost = item.service_cost or Decimal('0.00')
        cost_difference = new_cost - old_item_cost

        item.service_cost = new_cost
        item.slaughter_option_type = 'slaughtered' if slaughter else 'live'
        item.cutting_option = 'yes' if cutting else 'no'
        item.packaging_option = 'yes' if packaging else 'no'
        item.save()

        if order.service_cost:
            order.service_cost += (cost_difference * item.share_quantity)
        else:
            order.service_cost = (cost_difference * item.share_quantity)

        time_now_full = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
        order_note = f"\n🛠️ [تعديل الخدمات - {time_now_full}]: تم تحديث خدمات الحيوان #{animal.code} (: {'' if slaughter else ''} : {'' if cutting else ''} : {'' if packaging else ''})."
        order.notes = (order.notes or '') + order_note
        order.save(update_fields=['service_cost', 'notes'])

        fresh_order = Order.objects.prefetch_related('items').get(id=order.id)
        fresh_order.recalc_totals(commit=True)

        return Response({"detail": "تم تحديث الخدمات وتعديل الفاتورة بنجاح."})

    @action(detail=True, methods=['post'], url_path='cancel')
    @transaction.atomic
    def cancel(self, request, pk=None):
        access = get_effective_access(self.request.user, SystemModule.ORDERS)
        if access in[AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لإلغاء الطلبات.")

        order = self.get_object()
        if order.status in ['completed', 'canceled']:
            return Response({"detail": "لا يمكن إلغاء طلب مكتمل أو ملغي."}, status=status.HTTP_400_BAD_REQUEST)

        order.status = 'canceled'
        time_now = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
        log_entry = f"\n[نظام - {time_now}]: تم إلغاء الطلب من قبل الإدارة."
        order.notes = (order.notes or '') + log_entry
        order.save(update_fields=['status', 'notes'])

        for item in order.items.all():
            item.animal.status = 'available'
            item.animal.save(update_fields=['status'])

        return Response({"detail": "تم إلغاء الطلب بنجاح."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='suggest-replacements')
    def suggest_replacements(self, request, pk=None):
        order = self.get_object()
        item_id = request.query_params.get('item_id')
        item = get_object_or_404(OrderItem, id=item_id, order=order)
        missing_animal = item.animal

        latest_weight = WeightLog.objects.filter(
            animal=OuterRef('pk')
        ).order_by('-date', '-id').values('weight_kg')[:1]

        base_qs = Animal.objects.filter(
            category=missing_animal.category,
            status='available',
            is_hidden_from_store=False
        ).exclude(id=missing_animal.id).annotate(
            annotated_current_weight=Subquery(latest_weight, output_field=DecimalField())
        )

        is_adahi_item = item.listing_section in ['adahi_pool', 'adahi_group', 'adahi_full']
        is_share_item = item.listing_section in ['adahi_pool', 'adahi_group', 'shares']

        if is_share_item:
            base_qs = base_qs.prefetch_related(
                Prefetch('animallisting_set', queryset=AnimalListing.objects.filter(
                    section=item.listing_section, is_active=True
                ), to_attr='_relevant_listings')
            )

        valid_suggestions = []
        for animal in base_qs:
            if is_adahi_item:
                if animal.has_defect:
                    continue
                prediction = animal.get_eid_prediction()
                if not animal.is_sacrifice_valid_now and not (prediction and prediction.get('is_valid')):
                    continue

            if is_share_item:
                listing = animal._relevant_listings[0] if hasattr(animal, '_relevant_listings') and animal._relevant_listings else None
                available_shares = listing.available_shares if listing else (animal.category.default_max_shares or 1)
                if available_shares < item.share_quantity:
                    continue

            valid_suggestions.append(animal)

        valid_suggestions.sort(
            key=lambda a: abs((a.price_after_discount or a.price_egp) -
                            (missing_animal.price_after_discount or missing_animal.price_egp))
        )

        from livestock.serializers import AnimalSerializer
        serializer = AnimalSerializer(valid_suggestions[:5], many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='swap-animal')
    @transaction.atomic
    def swap_animal(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get('item_id')
        new_animal_id = request.data.get('new_animal_id')

        item = get_object_or_404(OrderItem, id=item_id, order=order)
        old_animal = item.animal
        new_animal = get_object_or_404(Animal, id=new_animal_id, status='available')

        if item.listing_section in ['adahi_pool', 'adahi_group', 'shares']:
            old_listing = AnimalListing.objects.filter(
                animal=old_animal,
                pipeline=item.pipeline,
                section=item.listing_section
            ).first()
            target_total_shares = old_listing.total_shares if old_listing else (new_animal.category.default_max_shares or 1)

            listing, created = AnimalListing.objects.select_for_update().get_or_create(
                animal=new_animal,
                pipeline=item.pipeline,
                section=item.listing_section,
                defaults={
                    'price': new_animal.price_after_discount or new_animal.price_egp,
                    'total_shares': target_total_shares,
                    'available_shares': target_total_shares,
                    'is_active': True
                }
            )
            if not created:
                listing.total_shares = target_total_shares
                if not listing.is_active:
                    listing.is_active = True
                    listing.available_shares = target_total_shares

            if listing.available_shares < item.share_quantity:
                return Response({"detail": "الحيوان البديل لا يملك أسهماً كافية لتغطية هذا الطلب."}, status=400)

            listing.available_shares -= item.share_quantity
            if listing.available_shares <= 0:
                listing.is_active = False
                new_animal.status = 'sold'
                new_animal.save(update_fields=['status'])
            listing.save()

            AnimalListing.objects.filter(animal=new_animal, is_active=True).exclude(id=listing.id).update(is_active=False, paused_due_to_order=True)

            if not new_animal.first_sale_at:
                new_animal.first_sale_at = timezone.now()
                new_animal.save(update_fields=['first_sale_at'])
        else:
            new_animal.status = 'sold' if order.deposit_total > 0 else 'reserved'
            new_animal.save(update_fields=['status'])
            AnimalListing.objects.filter(animal=new_animal).update(is_active=False)

        item.animal = new_animal
        item.price_per_item = new_animal.price_after_discount or new_animal.price_egp
        if not item.original_price:
            item.original_price = item.price_per_item
        item.save()

        completed_payments = order.payments.filter(status='completed').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        if completed_payments > 0:
            order.status = 'processing' if order.has_slaughter_service else 'confirmed'
        else:
            order.status = 'pending'

        time_now = timezone.localtime(timezone.now()).strftime('%I:%M %p')
        order.notes = (order.notes or '') + f"\n[نظام - {time_now}]: تم استبدال الحيوان المفقود #{old_animal.code}   #{new_animal.code}."
        order.save(update_fields=['status', 'notes'])
        order.recalc_totals(commit=True)

        return Response({"detail": "تم تخصيص البديل وتحديث الطلب بنجاح."})

    @action(detail=True, methods=['post'], url_path='refund-order')
    @transaction.atomic
    def refund_order(self, request, pk=None):
        order = self.get_object()
        payments = Payment.objects.filter(order=order, status='completed')
        payments.update(status='refunded')
        order.recalc_totals(commit=True)
        time_now = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
        order.notes = (order.notes or '') + f"\n[الإدارة - {time_now}]: تم عمل Refund للمبلغ المدفوع بالخطأ."
        order.save(update_fields=['notes'])
        return Response({"detail": "تم تسجيل استرجاع المبلغ (Refund) بنجاح."})

    @action(detail=True, methods=['post'], url_path='revive-order')
    @transaction.atomic
    def revive_order(self, request, pk=None):
        order = self.get_object()
        new_animal_id = request.data.get('new_animal_id')

        if order.status != 'canceled':
            return Response({"detail": "هذا الإجراء متاح فقط للطلبات الملغاة."}, status=status.HTTP_400_BAD_REQUEST)

        if not new_animal_id:
            return Response({"detail": "يرجى تحديد الحيوان البديل."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_animal = Animal.objects.get(id=new_animal_id, status='available')
        except Animal.DoesNotExist:
            return Response({"detail": "الحيوان البديل غير متاح حالياً."}, status=status.HTTP_400_BAD_REQUEST)

        item = order.items.first()
        old_animal_code = item.animal.code
        item.animal = new_animal
        item.save()

        new_animal.status = 'sold' if item.listing_section in ['full_sale', 'adahi_full'] else 'reserved'
        new_animal.save(update_fields=['status'])

        AnimalListing.objects.filter(animal=new_animal, is_active=True).exclude(section=item.listing_section).update(is_active=False, paused_due_to_order=True)

        order.status = 'confirmed'
        time_now = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
        order.notes = (order.notes or '') + f"\n[الإدارة - {time_now}]: تم إحياء الطلب بعد الدفع المتأخر، وتغيير الماشية من {old_animal_code} إلى {new_animal.code}."
        order.save(update_fields=['status', 'notes'])

        if send_notification:
            send_notification(order.user, title="تم إحياء طلبك!", message=f"تم استلام دفعتك وتأكيد طلبك وتخصيص الماشية رقم {new_animal.code} لك.", category="order")

        return Response({"detail": "تم إحياء الطلب وتخصيص الماشية الجديدة بنجاح."})

    @action(detail=True, methods=["post"], url_path="send-arrival-sms")
    def send_arrival_sms(self, request, pk=None):
        order = self.get_object()
        if hasattr(order, "driver") and order.driver != request.user and not request.user.is_staff:
            return Response({"detail": "غير مسموح لك بهذا الإجراء."}, status=status.HTTP_403_FORBIDDEN)

        if order.status != "out_for_delivery":
            return Response(
                {"detail": "لا يمكن إرسال رسالة الوصول إلا للطلبات قيد التوصيل."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order.arrival_sms_sent_at:
            time_passed = (timezone.now() - order.arrival_sms_sent_at).total_seconds()
            if time_passed < 300:
                return Response(
                    {"detail": "لقد أرسلت تنبيهاً للعميل منذ وقت قصير، يرجى الانتظار 5 دقائق قبل إعادة الإرسال."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        context_data = {
            'name': order.user.full_name or '',
            'id': order.id,
            'total': order.remaining_amount,
            'code': ''
        }
        from messaging.services import MessagingService
        MessagingService.send_template_message(order.user.phone, 'DRIVER_NEAR', context_data)

        time_now = timezone.now().strftime("%I:%M %p")
        order.notes = (order.notes or "") + f"\n[تتبع - {time_now}]: السائق أرسل رسالة (أنا في الطريق) للعميل."
        order.arrival_sms_sent_at = timezone.now()
        order.save(update_fields=["notes", "arrival_sms_sent_at"])

        return Response({"detail": "تم إرسال رسالة التنبيه للعميل بنجاح."})

    @action(detail=True, methods=["post"], url_path="send-delivery-otp")
    def send_delivery_otp(self, request, pk=None):
        import random
        order = self.get_object()
        if hasattr(order, "driver") and order.driver != request.user and not request.user.is_staff:
            return Response({"detail": "غير مسموح لك بهذا الإجراء."}, status=status.HTTP_403_FORBIDDEN)

        if order.status != "out_for_delivery":
            return Response(
                {"detail": "لا يمكن إرسال رمز التحقق إلا للطلبات قيد التوصيل."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        MAX_OTP_ATTEMPTS = 3
        if order.otp_sent_count >= MAX_OTP_ATTEMPTS and not request.user.is_staff:
            return Response(
                {"detail": f"لقد استنفذت الحد الأقصى ({MAX_OTP_ATTEMPTS} مرات). يرجى الاتصال بمنسق الرحلات لإرسال الكود نيابة عنك."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = str(random.randint(100000, 999999))
        time_now = timezone.now().strftime("%I:%M %p")

        if request.user.is_staff and order.otp_sent_count >= MAX_OTP_ATTEMPTS:
            order.notes = (order.notes or "") + f"\n[المنسق - {time_now}]: أرسل كود استلام (OTP) للعميل (تدخل إداري استثنائي)."
        else:
            order.notes = (order.notes or "") + f"\n[تتبع - {time_now}]: السائق طلب كود تسليم (OTP) للعميل للمرة {order.otp_sent_count + 1}."
            order.otp_sent_count += 1

        order.delivery_otp = otp
        order.save(update_fields=["delivery_otp", "notes", "otp_sent_count"])

        context_data = {
            'name': order.user.full_name or '',
            'code': otp,
            'id': order.id,
            'total': order.remaining_amount
        }
        from messaging.services import MessagingService
        MessagingService.send_template_message(order.user.phone, 'OTP', context_data, msg_type='OTP')

        return Response({
            "detail": "تم إرسال كود الاستلام (OTP) لهاتف العميل بنجاح.",
            "otp_sent_count": order.otp_sent_count,
        })

    @action(detail=True, methods=['post'], url_path='verify-delivery-otp')
    def verify_delivery_otp(self, request, pk=None):
        order = self.get_object()
        otp_input = request.data.get('otp', '').strip()
        if not order.delivery_otp or order.delivery_otp != otp_input:
            return Response({"detail": "الكود غير صحيح، يرجى المحاولة مرة أخرى."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "تم التحقق من الكود بنجاح."})

class ApprovalRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.has_perm('management.view_approvalrequest'):
            return ApprovalRequest.objects.all().order_by('-created_at')
        return ApprovalRequest.objects.filter(approver=user, status='pending').order_by('-created_at')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._resolve_request(request, pk, 'approved')

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._resolve_request(request, pk, 'rejected')

    @transaction.atomic
    def _resolve_request(self, request, pk, resolution):
        approval_request = self.get_object()
        if approval_request.status != 'pending':
            raise PermissionDenied("تم التعامل مع هذا الطلب مسبقاً.")
        if not (request.user == approval_request.approver or request.user.is_superuser or request.user.has_perm('management.change_approvalrequest')):
            raise PermissionDenied("لست مخولاً بالتعامل مع هذا الطلب.")
        approval_request.status = resolution
        approval_request.resolved_at = timezone.now()
        approval_request.resolution_notes = request.data.get('notes', '')

        if resolution == 'approved':
            action_completed = False
            try:
                if approval_request.action_type == 'delete_animal':
                    animal_id = approval_request.details.get('animal_id')
                    Animal.objects.get(pk=animal_id).delete()
                    action_completed = True

                elif approval_request.action_type == 'update_animal':
                    animal_id = approval_request.target_object_id
                    animal = Animal.objects.get(id=animal_id)
                    new_data = approval_request.pending_data or {}
                    allowed_fields =['name', 'category_id', 'sex', 'birth_date', 'price_egp', 'status', 'purchase_price', 'breed', 'description', 'deposit_egp', 'discount_percent', 'is_offer', 'location', 'internal_notes', 'is_hidden_from_store', 'has_defect', 'supplier_code', 'source_farm_id', 'entry_type']
                    for key, value in new_data.items():
                        if hasattr(animal, key) and key in allowed_fields:
                            setattr(animal, key, value)
                    animal.save()
                    action_completed = True

                elif approval_request.action_type == 'delete_employee':
                    employee_id = approval_request.details.get('employee_id')
                    Employee.objects.get(pk=employee_id).delete()
                    action_completed = True

                elif approval_request.action_type == 'delete_payroll':
                    payroll_id = approval_request.details.get('payroll_id')
                    Payroll.objects.get(pk=payroll_id).delete()
                    action_completed = True

                elif approval_request.action_type == 'suspend_customer':
                    customer_id = approval_request.details.get('customer_id')
                    should_suspend = approval_request.details.get('suspend')
                    reason = approval_request.details.get('reason')

                    customer = CustomerUser.objects.get(pk=customer_id)
                    customer.is_suspended = should_suspend
                    if should_suspend:
                        customer.suspension_reason = reason
                    customer.save()
                    action_completed = True

                elif approval_request.action_type == 'request_advance':
                    employee_id = approval_request.details.get('employee_id')
                    amount = Decimal(str(approval_request.details.get('amount')))
                    month = approval_request.details.get('month')
                    year = approval_request.details.get('year')

                    employee = Employee.objects.get(pk=employee_id)
                    payroll, _ = Payroll.objects.get_or_create(
                        employee=employee, month=month, year=year
                    )
                    PayrollEntry.objects.create(
                        payroll=payroll,
                        entry_type='advance',
                        description='سلفة معتمدة',
                        amount=amount
                    )
                    calculate_net_salary(payroll)
                    action_completed = True

                if action_completed:
                    approval_request.resolution_notes += f"\n[النظام] تم تطبيق التعديل/الحذف بنجاح."
            except (Animal.DoesNotExist, Employee.DoesNotExist, Payroll.DoesNotExist, CustomerUser.DoesNotExist):
                approval_request.status = 'rejected'
                approval_request.resolution_notes += "\n[النظام] خطأ: الكيان غير موجود. تم رفض الطلب."
            except Exception as e:
                approval_request.status = 'rejected'
                approval_request.resolution_notes += f"\n[النظام] خطأ أثناء التطبيق: {str(e)}. تم رفض الطلب."
        approval_request.save()
        return Response(ApprovalRequestSerializer(approval_request).data)

    @action(detail=False, methods=['post'], url_path='request-advance')
    def request_advance(self, request):
        employee_id = request.data.get('employee_id')
        amount = request.data.get('amount')

        if not employee_id or not amount:
            return Response({"detail": "Employee ID and amount are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(pk=employee_id)
            requester = request.user

            approver = Employee.objects.filter(is_superuser=True).exclude(pk=requester.pk).first()
            if not approver:
                return Response({"detail": "No manager available to approve."}, status=status.HTTP_400_BAD_REQUEST)

            now = date.today()

            ApprovalRequest.objects.create(
                requester=requester,
                approver=approver,
                action_type='request_advance',
                details={
                    'employee_id': employee.id,
                    'employee_name': employee.full_name,
                    'amount': amount,
                    'month': now.month,
                    'year': now.year
                },
                status='pending'
            )
            return Response({"detail": "Advance request submitted successfully."}, status=status.HTTP_201_CREATED)

        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

class AccessRuleBulkUpdateView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        target_type = request.query_params.get('target_type')
        target_id = request.query_params.get('target_id')

        filter_kwargs = {}
        if target_type == 'department':
            filter_kwargs['department_id'] = target_id
        elif target_type == 'role':
            filter_kwargs['role_id'] = target_id
        elif target_type == 'employee':
            filter_kwargs['employee_id'] = target_id
        else:
            return Response([])

        rules = ModuleAccessRule.objects.filter(**filter_kwargs)
        data = [
            {
                'module_name': r.module_name,
                'actions': r.actions,
                'excluded_pages': r.excluded_pages or []
            }
            for r in rules
        ]
        return Response(data)

    def post(self, request):
        if not request.user.is_superuser:
            return Response({"detail": "فقط المدير العام يمكنه تعديل الصلاحيات."}, status=403)

        target_type = request.data.get('target_type')
        target_id = request.data.get('target_id')
        rules = request.data.get('rules', {})
        excluded_pages_data = request.data.get('excluded_pages', {})

        filter_kwargs = {}
        if target_type == 'department':
            filter_kwargs['department_id'] = target_id
        elif target_type == 'role':
            filter_kwargs['role_id'] = target_id
        elif target_type == 'employee':
            filter_kwargs['employee_id'] = target_id
        else:
            return Response({"detail": "نوع الهدف غير صالح."}, status=400)

        with transaction.atomic():
            ModuleAccessRule.objects.filter(**filter_kwargs).delete()

            new_rules = []
            for module_name, actions in rules.items():
                rule = ModuleAccessRule(
                    module_name=module_name,
                    actions=actions,
                    excluded_pages=excluded_pages_data.get(module_name, []),
                    **filter_kwargs
                )
                new_rules.append(rule)

            ModuleAccessRule.objects.bulk_create(new_rules)

        affected_employees = []
        if target_type == 'employee':
            affected_employees.append(target_id)
        elif target_type == 'department':
            employee_ids = Employee.objects.filter(
                department_id=target_id, is_active=True
            ).values_list('id', flat=True)
            affected_employees.extend(employee_ids)
        elif target_type == 'role':
            employee_ids = Employee.objects.filter(
                role_id=target_id, is_active=True
            ).values_list('id', flat=True)
            affected_employees.extend(employee_ids)

        channel_layer = get_channel_layer()
        for emp_id in affected_employees:
            async_to_sync(channel_layer.group_send)(
                f"employee_notifications_{emp_id}",
                {
                    "type": "force_refresh_permissions",
                    "content": {"action": "refresh_permissions"}
                }
            )

        return Response({"detail": "تم تحديث الصلاحيات بنجاح."})

@api_view(['GET'])
@permission_classes([IsManagementUser])
def system_modules_list(request):
    modules = [{'id': choice[0], 'name': choice[1]} for choice in SystemModule.choices]
    return Response(modules)

class ApprovalRoutingSetView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        routes = ApprovalRouting.objects.all().values('module_name', 'designated_approver')
        return Response(routes)

    def post(self, request):
        if not request.user.is_superuser:
            return Response({"detail": "غير مصرح لك."}, status=403)

        module_name = request.data.get('module_name')
        approver_id = request.data.get('designated_approver')

        if not approver_id:
            ApprovalRouting.objects.filter(module_name=module_name).delete()
        else:
            ApprovalRouting.objects.update_or_create(
                module_name=module_name,
                defaults={'designated_approver_id': approver_id}
            )
        return Response({"detail": "تم تحديث مسار الموافقة."})

class WeightLogViewSet(viewsets.ModelViewSet):
    serializer_class = WeightLogCreateSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        animal_uuid = self.kwargs.get('animal_unique_id')
        if animal_uuid:
            return WeightLog.objects.filter(animal__unique_id=animal_uuid).order_by('-date')
        return WeightLog.objects.none()

    def perform_create(self, serializer):
        animal = generics.get_object_or_404(Animal, unique_id=self.kwargs['animal_unique_id'])
        serializer.save(animal=animal, recorded_by=self.request.user)

class HealthLogViewSet(viewsets.ModelViewSet):
    permission_classes = [IsManagementUser]
    serializer_class = HealthLogCreateSerializer

    def get_queryset(self):
        animal_uuid = self.kwargs.get('animal_unique_id')
        if animal_uuid:
            return HealthLog.objects.filter(animal__unique_id=animal_uuid).order_by('-log_date')
        return HealthLog.objects.all().order_by('-log_date')

    def perform_create(self, serializer):
        animal_uuid = self.kwargs.get('animal_unique_id')
        animal = generics.get_object_or_404(Animal, unique_id=animal_uuid)
        vet_user = self.request.user if hasattr(self.request.user, 'is_staff') else None
        serializer.save(animal=animal, vet=vet_user)

class FeedingLogViewSet(viewsets.ModelViewSet):
    queryset = FeedingLog.objects.all()
    serializer_class = FeedingLogCreateSerializer
    permission_classes = [IsManagementUser]

class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().order_by('name')
    serializer_class = InventoryItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['type']
    permission_classes = [IsManagementUser]

    def create(self, request, *args, **kwargs):
        access = get_effective_access(request.user, SystemModule.INVENTORY)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية للوصول لهذه الشاشة.")
        return super().create(request, *args, **kwargs)

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().prefetch_related('items')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsManagementUser]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        requester = self.request.user
        access = get_effective_access(requester, SystemModule.INVENTORY)
        if access == AccessLevel.FULL_ACCESS:
            instance.delete()
            return Response({"detail": "تم حذف أمر الشراء بنجاح."}, status=status.HTTP_200_OK)
        elif access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.INVENTORY)
            if not approver:
                raise PermissionDenied("لا يوجد مدير متاح للموافقة على طلب الحذف.")
            if ApprovalRequest.objects.filter(action_type='delete_purchase_order', details__order_id=instance.id, status='pending').exists():
                raise PermissionDenied("يوجد بالفعل طلب حذف معلق لأمر الشراء هذا.")
            ApprovalRequest.objects.create(
                requester=requester, approver=approver, action_type='delete_purchase_order',
                details={'order_id': instance.id, 'supplier_name': instance.supplier.name if instance.supplier else ''},
                status='pending'
            )
            return Response({"detail": "تم إرسال طلب الحذف للموافقة."}, status=status.HTTP_200_OK)
        else:
            raise PermissionDenied("ليس لديك صلاحية لحذف أوامر الشراء.")

    @action(detail=True, methods=['post'], url_path='receive')
    @transaction.atomic
    def receive_items(self, request, pk=None):
        order = self.get_object()
        for item in order.items.all():
            lot = InventoryLot.objects.create(
                item=item.item, purchase_order=order,
                initial_quantity=item.quantity, remaining_quantity=item.quantity
            )
            StockMovement.objects.create(
                item=item.item, lot=lot, quantity=item.quantity,
                movement_type='purchase', user=request.user,
                notes=f"استلام من أمر الشراء رقم #{order.id}"
            )
        order.status = 'received'
        order.save()
        return Response(PurchaseOrderSerializer(order).data)

class DashboardAPIView(APIView):
    permission_classes = [IsManagementUser, CanViewDashboard]

    def get(self, request, *args, **kwargs):
        today = timezone.localtime(timezone.now()).date()

        from payments.models import Payment
        today_payments = Payment.objects.filter(status='completed', created_at__date=today).aggregate(total=Sum('amount'))['total'] or 0

        tomorrow = today + timedelta(days=1)
        urgent_orders = Order.objects.filter(
            status__in=['confirmed', 'processing', 'ready_for_shipment'],
            delivery_date__lte=tomorrow
        ).select_related('user').order_by('delivery_date', 'created_at')[:10]

        urgent_orders_data = [
            {
                "id": o.id,
                "customer_name": o.user.full_name,
                "status": o.get_status_display(),
                "delivery_date": o.delivery_date,
                "remaining_amount": o.remaining_amount
            } for o in urgent_orders
        ]

        low_stock_items = []
        for item in InventoryItem.objects.all():
            if item.current_stock <= item.min_stock_level:
                low_stock_items.append({
                    "name": item.name,
                    "current": item.current_stock,
                    "min": item.min_stock_level,
                    "unit": item.unit_of_measure
                })

        livestock_stats = Animal.objects.aggregate(
            available=Count('id', filter=Q(status='available')),
            reserved=Count('id', filter=Q(status='reserved'))
        )

        data = {
            'today_revenue': today_payments,
            'urgent_orders': urgent_orders_data,
            'low_stock_items': low_stock_items,
            'livestock_summary': livestock_stats,
            'orders_today_count': Order.objects.filter(created_at__date=today).count(),
        }
        return Response(data)

class FCRReportAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request, *args, **kwargs):
        animal_id = request.query_params.get('animal_id')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        if not all([animal_id, start_date_str, end_date_str]):
            return Response({"error": "animal_id, start_date, and end_date are required parameters."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            animal = Animal.objects.get(pk=animal_id)
            start_date = date.fromisoformat(start_date_str)
            end_date = date.fromisoformat(end_date_str)
        except (Animal.DoesNotExist, ValueError):
            return Response({"error": "Invalid animal_id or date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        fcr_data = calculate_fcr_for_animal(animal, start_date, end_date)
        return Response(fcr_data)

class AnimalProfitabilityReportAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request, *args, **kwargs):
        animal_id = request.query_params.get('animal_id')
        if not animal_id:
            return Response({"error": "animal_id is a required query parameter."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            animal = Animal.objects.get(pk=animal_id)
        except Animal.DoesNotExist:
            return Response({"error": "Animal not found."}, status=status.HTTP_404_NOT_FOUND)
        profitability_data = calculate_animal_profitability(animal)
        if "error" in profitability_data:
            return Response(profitability_data, status=status.HTTP_400_BAD_REQUEST)
        return Response(profitability_data)

class DeliverySettingAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        instance, created = DeliverySetting.objects.get_or_create(pk=1)
        serializer = DeliverySettingSerializer(instance)
        return Response(serializer.data)

    def patch(self, request):
        instance, created = DeliverySetting.objects.get_or_create(pk=1)
        serializer = DeliverySettingSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def create(self, request):
        return self.update(request)

class OnFarmSaleAPIView(APIView):
    permission_classes = [IsManagementUser]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        data = request.data
        animal_items_data = data.get('animal_items', [])
        customer_name = data.get('customer_name')
        customer_phone_raw = data.get('customer_phone')
        customer_email = data.get('customer_email')
        payment_method = data.get('payment_method', 'cash')
        delivery_type = data.get('delivery_type', 'pickup')
        delivery_date_str = data.get('delivery_date')
        delivery_address_id = data.get('delivery_address_id')
        new_address_data = data.get('new_address')
        order_notes = data.get('notes')
        payment_type = data.get('payment_type', 'full')
        deposit_amount_str = data.get('deposit_amount', '0')
        is_corporate = data.get('is_corporate', False)
        business_name = data.get('business_name', '')

        if not all([animal_items_data, customer_name, customer_phone_raw]):
            raise ValidationError({"detail": "بيانات الحيوانات والعميل (الاسم والهاتف) مطلوبة."})

        customer_phone = normalize_phone(customer_phone_raw)
        if not customer_phone:
            raise ValidationError({"detail": "صيغة رقم الهاتف غير صحيحة."})

        delivery_date = None
        if delivery_date_str:
            try:
                delivery_date = date.fromisoformat(delivery_date_str)
            except (ValueError, TypeError):
                raise ValidationError({"detail": "صيغة تاريخ التسليم غير صحيحة."})
        elif delivery_type == 'pickup' and not delivery_date_str:
            delivery_date = date.today()
        elif not delivery_date_str and delivery_type != 'pickup':
            raise ValidationError({"detail": "يجب تحديد تاريخ التوصيل."})

        customer, created = CustomerUser.objects.get_or_create(
            phone=customer_phone,
            defaults={
                'full_name': customer_name,
                'email': customer_email,
                'is_active': True,
                'is_phone_verified': True,
                'is_corporate': is_corporate,
                'business_name': business_name
            }
        )
        if created:
            customer.set_unusable_password()
            customer.save()
        else:
            customer.full_name = customer_name
            if customer_email:
                customer.email = customer_email
            customer.is_corporate = is_corporate
            if business_name:
                customer.business_name = business_name
            customer.save()

        if customer.is_suspended:
            reason = customer.custom_notification or "هذا الحساب موقوف. لا يمكن إتمام عمليات البيع."
            raise PermissionDenied({"detail": reason})

        delivery_address_instance = None
        if delivery_type == 'delivery':
            if delivery_address_id and delivery_address_id != 'new_address':
                try:
                    delivery_address_instance = Address.objects.get(id=delivery_address_id, user=customer)
                except Address.DoesNotExist:
                    raise ValidationError({"detail": "العنوان المحدد غير صحيح أو لا يخص هذا العميل."})
            elif new_address_data and isinstance(new_address_data, dict):
                if not all(k in new_address_data for k in ['governorate', 'city', 'street']):
                    raise ValidationError({"detail": "بيانات العنوان الجديد غير مكتملة."})
                delivery_address_instance = Address.objects.create(user=customer, **new_address_data)
                if customer.addresses.count() == 1:
                    delivery_address_instance.is_default = True
                    delivery_address_instance.save()
            else:
                raise ValidationError({"detail": "يجب اختيار أو إضافة عنوان للتوصيل."})

        delivery_settings = DeliverySetting.objects.first()
        if not delivery_settings:
            raise ValidationError({"detail": "لم يتم تكوين إعدادات التوصيل بعد."})

        order_animal_price = Decimal('0.00')
        order_service_cost = Decimal('0.00')
        order_items_to_create = []
        has_slaughter_service = False

        for item_data in animal_items_data:
            try:
                animal = Animal.objects.select_for_update().get(id=item_data['animal_id'], status='available')
            except Animal.DoesNotExist:
                raise ValidationError({"detail": f"الحيوان المحدد لم يعد متاحًا أو تم بيعه."})

            share_qty = item_data.get('share_quantity', 1)
            item_selected_services = item_data.get('services', {})

            calculation = PricingService.calculate_item_price(
                animal=animal,
                share_qty=share_qty,
                services=item_selected_services,
                user=customer,
                pipeline='M',
                section='full_sale'
            )

            item_selected_services['_discount_source'] = calculation.get('discount_source', 'none')
            item_selected_services['_discount_amount'] = float(calculation.get('discount_amount', 0))
            final_price_per_share = calculation['final_item_price']
            service_cost_per_share = calculation['service_cost']
            request_video = item_selected_services.get("request_video", False)

            order_animal_price += final_price_per_share
            order_service_cost += service_cost_per_share

            if item_selected_services.get('slaughter'):
                has_slaughter_service = True

            order_items_to_create.append({
                'animal': animal,
                'price_per_item': final_price_per_share,
                'deposit_per_item': Decimal('0.00'),
                'service_cost': service_cost_per_share,
                'selected_services': item_selected_services,
                'share_quantity': share_qty,
                'listing_section': 'full_sale',
                'request_slaughter_video': request_video
            })

        order_total_price = order_animal_price + order_service_cost
        deposit_total = Decimal('0.00')

        operation_settings = OperationSettings.load()

        if payment_type == 'deposit':
            deposit_percentage = delivery_settings.service_deposit_percentage if has_slaughter_service else delivery_settings.min_deposit_percentage
            deposit_on_animals = (order_animal_price * deposit_percentage).quantize(Decimal('0.01'))
            min_deposit_required = deposit_on_animals + order_service_cost
            try:
                deposit_total = Decimal(deposit_amount_str).quantize(Decimal('0.01'))
                if deposit_total < min_deposit_required:
                    raise ValidationError({"detail": f"مبلغ العربون المدخل {deposit_total} أقل من الحد الأدنى المطلوب وهو {min_deposit_required} جنيه."})
                if deposit_total > order_total_price:
                    raise ValidationError({"detail": "مبلغ العربون لا يمكن أن يكون أكبر من إجمالي الطلب."})
            except InvalidOperation:
                raise ValidationError({"detail": "صيغة مبلغ العربون غير صحيحة."})
        else:
            deposit_total = order_total_price

        remaining_amount = order_total_price - deposit_total

        order = Order.objects.create(
            user=customer,
            status='completed' if remaining_amount <= 0 else 'pending',
            total_price=order_total_price,
            deposit_total=deposit_total,
            remaining_amount=remaining_amount,
            service_cost=order_service_cost,
            payment_method=payment_method,
            delivery_type=delivery_type,
            delivery_date=delivery_date,
            delivery_address=delivery_address_instance,
            source='on_farm',
            created_by_employee=request.user,
            notes=order_notes,
            pricing_model=operation_settings.pricing_model
        )

        response_data = {
            "detail": "تم تسجيل الطلب بنجاح!",
            "order_id": order.id,
        }

        if deposit_total > 0:
            if payment_method == 'paymob':
                payment = Payment.objects.create(
                    order=order,
                    user=customer,
                    amount=deposit_total,
                    payment_method='paymob',
                    status='pending'
                )

                try:
                    from payments.services.paymob_service import PaymobService
                    paymob = PaymobService()

                    merchant_order_id = f"{order.id}_{payment.id}"

                    full_name_parts = customer.full_name.split() if customer.full_name else ["NA"]
                    billing_data = {
                        "email": customer.email or "customer@lahmfarm.com",
                        "first_name": full_name_parts[0] if full_name_parts else "NA",
                        "last_name": " ".join(full_name_parts[1:]) if len(full_name_parts) > 1 else "NA",
                        "phone_number": customer.phone or "01000000000",
                    }

                    animal_codes =[item_to_create['animal'].code for item_to_create in order_items_to_create if item_to_create.get('animal')]
                    items_desc = f"متجر لَحِم | طلب #{order.id}" + (f" | : {', '.join(animal_codes)}" if animal_codes else "")
                    link_data = paymob.create_quick_link(deposit_total, billing_data, merchant_order_id, items_description=items_desc)
                    payment.transaction_id = link_data["paymob_order_id"]
                    payment.save()

                    response_data['payment_url'] = link_data["payment_url"]
                    response_data['detail'] = "تم إنشاء الطلب. يرجى إرسال رابط الدفع للعميل."
                    if customer.phone:
                        try:
                            from messaging.services import MessagingService
                            from accounts.utils import validate_phone_with_country
                            valid_phone = validate_phone_with_country('EG', customer.phone)
                            first_name = customer.full_name.split()[0] if customer.full_name else "عميلنا"
                            sms_text = f"مرحباً {first_name}، لدفع مبلغ ({deposit_total} ج.م) لطلبك رقم #{order.id}    :\n{link_data['payment_url']}"
                            MessagingService.send_message(phone=valid_phone, content=sms_text, msg_type='AUTOMATED', user=request.user)
                            response_data['detail'] = "تم إنشاء الطلب، وتم إرسال رابط الدفع للعميل في رسالة SMS آلياً."
                        except Exception as e:
                            logger.error(f"Failed to send SMS payment link: {e}")

                except Exception as e:
                    logger.error(f"فشل إنشاء جلسة دفع Paymob للطلب {order.id}: {str(e)}")
                    payment.status = 'failed'
                    payment.save()
                    response_data['detail'] = "تم إنشاء الطلب ولكن فشل إنشاء رابط الدفع. يرجى المحاولة لاحقاً."

            else:
                Payment.objects.create(
                    order=order,
                    user=customer,
                    amount=deposit_total,
                    payment_method=payment_method,
                    status='completed',
                    transaction_id=f"POS-{order.id}-{timezone.now().timestamp()}"
                )
                response_data['invoice_url'] = request.build_absolute_uri(f'/api/orders/invoice/{order.id}/')

        for item_to_create in order_items_to_create:
            animal_instance = item_to_create['animal']
            item_to_create['deposit_per_item'] = item_to_create['deposit_per_item'].quantize(Decimal('0.01'))
            OrderItem.objects.create(order=order, **item_to_create)

            if item_to_create['listing_section'] in ['full_sale', 'adahi_full']:
                animal_instance.status = 'sold' if payment_type == 'full' else 'reserved'
                animal_instance.save(update_fields=['status'])

        order.recalc_totals(commit=True)
        return Response(response_data, status=status.HTTP_201_CREATED)

class ServicePriceSettingViewSet(viewsets.ModelViewSet):
    queryset = ServicePriceSetting.objects.all().order_by('name')
    serializer_class = ServicePriceSettingSerializer
    permission_classes = [IsManagementUser]

class GlobalDiscountSettingsView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        settings = GlobalDiscountSettings.load()
        return Response(GlobalDiscountSettingsSerializer(settings).data)

    def post(self, request):
        settings = GlobalDiscountSettings.load()
        old_percentage = settings.percentage

        data = request.data.copy()

        if 'percentage' in data and not data['percentage']:
            data['percentage'] = 0

        for field in ['start_date', 'end_date']:
            if field in data and data[field] == '':
                data[field] = None

        serializer = GlobalDiscountSettingsSerializer(settings, data=data)
        if serializer.is_valid():
            new_settings = serializer.save()

            if old_percentage != new_settings.percentage:
                DiscountLog.objects.create(
                    target_type='global',
                    changed_by=request.user,
                    old_percentage=old_percentage,
                    new_percentage=new_settings.percentage,
                    notes="تحديث إعدادات الخصم العام"
                )
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DiscountLogListView(generics.ListAPIView):
    queryset = DiscountLog.objects.all().order_by('-timestamp')
    serializer_class = DiscountLogSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        queryset = DiscountLog.objects.all().order_by('-timestamp')
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(target_user_id=user_id)
        return queryset

class CustomerLookupAPIView(APIView):
    permission_classes = [IsManagementUser]

    def post(self, request, *args, **kwargs):
        phone = request.data.get('phone')
        full_name = request.data.get('full_name', 'عميل جديد (خدمة العملاء)')
        email = request.data.get('email')
        is_corporate = request.data.get('is_corporate', False)
        business_name = request.data.get('business_name', '')

        if not phone:
            return Response({"detail": "رقم الهاتف مطلوب."}, status=status.HTTP_400_BAD_REQUEST)

        normalized_phone = normalize_phone(phone)
        if not normalized_phone:
            return Response({"detail": "صيغة رقم الهاتف غير صحيحة."}, status=status.HTTP_400_BAD_REQUEST)

        user, created = CustomerUser.objects.get_or_create(
            phone=normalized_phone,
            defaults={
                'full_name': full_name,
                'email': email,
                'is_corporate': is_corporate,
                'business_name': business_name,
                'is_active': True,
                'is_phone_verified': False
            }
        )

        if created:
            user.set_unusable_password()
            user.save()
            return Response({"detail": "تم إنشاء حساب العميل بنجاح", "phone": normalized_phone}, status=status.HTTP_201_CREATED)
        else:
            return Response({"detail": "العميل مسجل بالفعل", "phone": normalized_phone}, status=status.HTTP_200_OK)

    def get_customer(self, phone_query):
        if not phone_query:
            raise ValidationError({"detail": "بيانات البحث مطلوبة."})

        if '@' in phone_query:
            try:
                return CustomerUser.objects.prefetch_related(
                    'addresses', 'orders__items__animal', 'special_requests'
                ).get(email__iexact=phone_query.strip())
            except CustomerUser.DoesNotExist:
                raise ValidationError({"detail": "لا يوجد عميل مسجل بهذا البريد الإلكتروني."})

        normalized_phone = normalize_phone(phone_query)
        if not normalized_phone:
            raise ValidationError({"detail": "صيغة رقم الهاتف غير صحيحة."})

        try:
            return CustomerUser.objects.prefetch_related(
                'addresses', 'orders__items__animal', 'special_requests', 'discount_logs'
            ).get(phone=normalized_phone)
        except CustomerUser.DoesNotExist:
            raise ValidationError({"detail": "لا يوجد عميل مسجل بهذا الرقم."})

    def get(self, request, *args, **kwargs):
        phone_query = request.query_params.get('phone', None)
        try:
            customer = self.get_customer(phone_query)
            from .serializers import CustomerLookupSerializer
            from messaging.serializers import MessageLogSerializer
            from notifications.serializers import NotificationSerializer
            from .serializers import CustomerCallLogSerializer, ContactMessageSerializer

            serializer = CustomerLookupSerializer(customer)
            response_data = serializer.data

            normalized_phone = customer.phone

            call_logs = CustomerCallLog.objects.filter(
                Q(customer_phone=normalized_phone) | Q(customer_phone=phone_query)
            ).order_by('-start_time')

            contact_messages = ContactMessage.objects.filter(
                Q(phone=normalized_phone) | Q(phone=phone_query) | Q(user=customer)
            ).order_by('-created_at')

            push_notifs = Notification.objects.filter(user=customer).order_by('-created_at')

            email_query = Q()
            if customer.email:
                email_query = Q(recipient__iexact=customer.email)

            sms_logs = MessageLog.objects.filter(
                Q(recipient__icontains=normalized_phone[-10:]) | email_query
            ).order_by('-created_at')

            response_data['call_logs'] = CustomerCallLogSerializer(call_logs, many=True).data
            response_data['contact_messages'] = ContactMessageSerializer(contact_messages, many=True).data
            response_data['push_notifications'] = NotificationSerializer(push_notifs, many=True).data
            response_data['sms_logs'] = MessageLogSerializer(sms_logs, many=True).data

            return Response(response_data)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, *args, **kwargs):
        phone_query = request.query_params.get('phone', None)
        try:
            customer = self.get_customer(phone_query)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        update_data = {}

        allowed_fields =[
            'notes', 'is_suspended', 'suspension_reason', 'is_restricted', 'restriction_reason', 'custom_notification',
            'allow_global_discount', 'is_discount_active', 'special_discount_percentage',
            'special_discount_type', 'special_discount_amount',
            'discount_applies_to_services', 'discount_start_date', 'discount_end_date',
            'discount_max_animals', 'discount_custom_message', 'is_corporate', 'business_name'
        ]

        old_percentage = customer.special_discount_percentage
        old_amount = customer.special_discount_amount
        old_type = customer.special_discount_type
        old_special_active = customer.is_discount_active
        old_global_allow = customer.allow_global_discount
        old_notes = customer.notes
        old_suspended = customer.is_suspended
        old_restricted = customer.is_restricted

        for key in allowed_fields:
            if key in request.data:
                val = request.data[key]

                if key in['allow_global_discount', 'is_discount_active', 'discount_applies_to_services', 'is_suspended', 'is_restricted']:
                    if str(val).lower() == 'true':
                        val = True
                    elif str(val).lower() == 'false':
                        val = False

                if key in['allow_global_discount', 'is_discount_active', 'discount_applies_to_services', 'is_suspended', 'is_restricted']:
                    if val == '' or val is None: val = 0
                elif key in['discount_start_date', 'discount_end_date'] and (val == '' or val is None):
                    val = None

                update_data[key] = val
                setattr(customer, key, val)

        if update_data:
            customer.save()
            customer.refresh_from_db()

            serializer = DashboardCustomerSerializer(customer)
            updated_customer = customer

            if 'notes' in update_data and update_data['notes'] != old_notes:
                CustomerNoteLog.objects.create(
                    customer=updated_customer, note=update_data['notes'], added_by=request.user
                )

            if 'is_restricted' in update_data and update_data['is_restricted'] != old_restricted:
                if not updated_customer.is_restricted:
                    updated_customer.last_cancel_reset_at = timezone.now()
                    updated_customer.save(update_fields=['last_cancel_reset_at'])

                CustomerSuspensionLog.objects.create(
                    customer=updated_customer,
                    action='restricted' if updated_customer.is_restricted else 'unrestricted',
                    reason=updated_customer.restriction_reason if updated_customer.is_restricted else 'فك التقييد',
                    changed_by=request.user
                )

            new_percent = updated_customer.special_discount_percentage
            new_amount = updated_customer.special_discount_amount
            new_type = updated_customer.special_discount_type
            new_special_active = updated_customer.is_discount_active
            new_global_allow = updated_customer.allow_global_discount

            log_notes =[]

            if old_special_active != new_special_active:
                status_text = "تفعيل" if new_special_active else "إيقاف"
                log_notes.append(f"تم {status_text} الخصم الخاص")

            if old_type != new_type or old_percentage != new_percent or old_amount != new_amount:
                if new_type == 'fixed':
                    log_notes.append(f"تغيير القسيمة إلى مبلغ {new_amount} ج.م")
                else:
                    log_notes.append(f"تغيير النسبة إلى {new_percent}%")

            if old_global_allow != new_global_allow:
                status_text = "السماح بـ" if new_global_allow else "منع"
                log_notes.append(f"تم {status_text} الخصم العام")

            if log_notes:
                from .models import DiscountLog
                DiscountLog.objects.create(
                    target_type='user',
                    target_user=updated_customer,
                    changed_by=request.user,
                    old_percentage=old_percentage,
                    new_percentage=new_percent,
                    notes=" | ".join(log_notes)
                )

            return Response(serializer.data)

        return Response({"detail": "لم يتم تقديم بيانات للتحديث."}, status=status.HTTP_400_BAD_REQUEST)

class OrderLedgerAPIView(generics.ListAPIView):
    serializer_class = OrderLedgerSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        queryset = Order.objects.select_related(
            'user', 'created_by_employee__department'
        ).prefetch_related('items__animal').order_by('-created_at')
        source = self.request.query_params.get('source')
        if source in ['on_farm', 'online_store']:
            queryset = queryset.filter(source=source)
        start_date_str = self.request.query_params.get('start_date')
        end_date_str = self.request.query_params.get('end_date')
        if start_date_str:
            queryset = queryset.filter(created_at__date__gte=start_date_str)
        if end_date_str:
            queryset = queryset.filter(created_at__date__lte=end_date_str)
        return queryset

class PermissionsViewSet(viewsets.ViewSet):
    permission_classes = [IsSuperuser]

    def list(self, request):
        permission_groups = {
            "الداشبورد العام": {"description": "الوصول إلى لوحة التحكم الرئيسية والتقارير العامة.", "perms": ["management.view_dashboard", "accounting.view_financial_reports"]},
            "إدارة العملاء والبيع": {"description": "عرض وتعديل الطلبات، البيع المباشر، والبحث عن العملاء.", "perms": ["orders.view_order", "orders.change_order", "orders.add_order", "accounts.view_user", "accounts.change_user"]},
            "إدارة المواشي": {"description": "عرض، إضافة، وتعديل بيانات المواشي والفئات.", "perms": ["livestock.view_animal", "livestock.add_animal", "livestock.change_animal", "livestock.delete_animal", "livestock.view_category", "livestock.add_category", "livestock.change_category"]},
            "إدارة الموظفين": {"description": "إدارة بيانات الموظفين، الأقسام، والأدوار الوظيفية.", "perms": ["management.view_employee", "management.add_employee", "management.change_employee", "management.delete_employee", "management.view_farmdepartment", "management.add_farmdepartment", "management.change_farmdepartment", "management.view_employeerole", "management.add_employeerole", "management.change_employeerole"]},
            "المخزون والموردين": {"description": "إدارة أصناف المخزون، الموردين، وحركات المخزون.", "perms": ["management.view_inventoryitem", "management.add_inventoryitem", "management.change_inventoryitem", "management.view_supplier", "management.add_supplier", "management.change_supplier", "management.view_stockmovement", "management.add_stockmovement"]},
            "المحاسبة والرواتب": {"description": "الوصول إلى المصروفات، الرواتب، وقيود اليومية.", "perms": ["accounting.view_expense", "accounting.add_expense", "accounting.view_journalentry", "management.view_payroll", "management.add_payroll", "management.change_payroll", "management.delete_payroll"]},
            "الإدارة العليا والموافقات": {"description": "مراجعة الطلبات المعلقة والتحكم في صلاحيات الأدوار (صلاحيات حساسة).", "perms": ["management.view_approvalrequest", "management.change_approvalrequest", "auth.change_permission"]},
        }
        all_perms = Permission.objects.select_related('content_type').all()
        perm_map = {f"{p.content_type.app_label}.{p.codename}": p.id for p in all_perms}
        result = []
        for group_name, data in permission_groups.items():
            perm_ids = [perm_map[p_str] for p_str in data["perms"] if p_str in perm_map]
            if perm_ids:
                result.append({"groupName": group_name, "description": data["description"], "permissionIds": perm_ids})
        return Response(result)

    @action(detail=False, methods=['get'])
    def all(self, request):
        permissions = Permission.objects.select_related('content_type').exclude(
            content_type__app_label__in=['admin', 'auth', 'sessions', 'contenttypes']
        ).order_by('content_type__app_label', 'codename')
        serializer = SimplePermissionSerializer(permissions, many=True)
        return Response(serializer.data)

class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        user = self.request.user
        return user.chat_rooms.all().prefetch_related('participants', 'messages').order_by('-created_at')

    @action(detail=False, methods=['get'], url_path='all-system-rooms')
    def all_system_rooms(self, request):
        if not request.user.is_superuser and not request.user.has_perm('management.can_view_all_chats'):
            raise PermissionDenied("غير مصرح لك بمراقبة النظام.")
        rooms = ChatRoom.objects.all().prefetch_related('participants', 'messages').order_by('-created_at')
        serializer = self.get_serializer(rooms, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='deleted-messages')
    def deleted_messages(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied("غير مصرح لك بمراقبة النظام.")

        msgs = ChatMessage.objects.filter(is_deleted=True).select_related(
            'author', 'room', 'deleted_for_everyone_by'
        ).order_by('-deleted_at')

        data = []
        for m in msgs:
            room_name = m.room.name
            if m.room.room_type == 'DIRECT':
                room_name = " ↔ ".join([p.full_name.split(' ')[0] for p in m.room.participants.all()])

            data.append({
                'id': m.id,
                'room_name': room_name,
                'author_name': m.author.full_name,
                'content': m.content,
                'deleted_at': m.deleted_at,
                'deleted_by': m.deleted_for_everyone_by.full_name if m.deleted_for_everyone_by else 'مجهول'
            })
        return Response(data)

    def create(self, request, *args, **kwargs):
        participants_ids = request.data.get('participants_ids', [])
        room_name = request.data.get('name', '')
        room_type = request.data.get('room_type', 'DIRECT')
        allowed_writers_ids = request.data.get('allowed_writers_ids', [])
        user = request.user

        if not isinstance(participants_ids, list):
            return Response({"detail": "participants_ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        if room_type == 'DIRECT':
            if len(participants_ids) != 1:
                return Response({"detail": "Direct chat requires exactly one other participant."},
                                status=status.HTTP_400_BAD_REQUEST)

            other_user_id = int(participants_ids[0])
            if user.id == other_user_id:
                return Response({"detail": "You cannot start a chat with yourself."},
                                status=status.HTTP_400_BAD_REQUEST)

            existing_room = ChatRoom.objects.filter(
                room_type='DIRECT',
                participants=user
            ).filter(participants__id=other_user_id).first()

            if existing_room and existing_room.participants.count() == 2:
                return Response(ChatRoomSerializer(existing_room, context={'request': request}).data)

        participants_set = set(participants_ids)
        participants_set.add(user.id)

        room = ChatRoom.objects.create(
            name=room_name,
            room_type=room_type
        )
        room.participants.set(list(participants_set))

        if room_type == 'GROUP' and allowed_writers_ids:
            if not isinstance(allowed_writers_ids, list):
                return Response({"detail": "allowed_writers_ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)
            writers_set = set(allowed_writers_ids)
            writers_set.add(user.id)
            room.allowed_writers.set(list(writers_set))

        return Response(ChatRoomSerializer(room, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='mark-as-read')
    def mark_as_read(self, request, pk=None):
        room = self.get_object()
        user = request.user

        if user.is_superuser and not room.participants.filter(id=user.id).exists():
            return Response({'status': 'read receipt skipped for superuser'}, status=status.HTTP_200_OK)

        messages_to_update = room.messages.exclude(author=user).filter(is_read=False)

        if messages_to_update.exists():
            updated_message_ids = list(messages_to_update.values_list('id', flat=True))
            messages_to_update.update(is_read=True)

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'chat_{room.id}',
                {
                    'type': 'read_receipt_notification',
                    'room_id': room.id,
                    'updated_message_ids': updated_message_ids
                }
            )

        return Response({'status': 'messages marked as read'}, status=status.HTTP_200_OK)

class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsManagementUser]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    pagination_class = None

    def get_queryset(self):
        room_pk = self.kwargs.get('room_pk')
        user = self.request.user

        if not user.is_superuser:
            is_participant = ChatRoom.objects.filter(id=room_pk, participants=user).exists()
            if not is_participant:
                return ChatMessage.objects.none()

        qs = ChatMessage.objects.filter(room_id=room_pk).select_related('author__department', 'deleted_for_everyone_by')

        if not user.is_superuser:
            qs = qs.exclude(deleted_for_users=user)

        return qs.order_by('timestamp')

    def perform_create(self, serializer):
        room_pk = self.kwargs.get('room_pk')
        room = generics.get_object_or_404(ChatRoom, pk=room_pk)

        if not (self.request.user.is_superuser or room.participants.filter(id=self.request.user.id).exists()):
            raise PermissionDenied("ليس لديك صلاحية لإرسال رسائل في هذه الغرفة.")

        raw_content = self.request.data.get('content', '')
        safe_content = escape(raw_content) if raw_content else ''

        serializer.save(author=self.request.user, room=room, content=safe_content)

    @action(detail=True, methods=['delete'], permission_classes=[])
    def delete_message(self, request, room_pk=None, pk=None):
        message = self.get_object()
        delete_type = request.data.get('type', 'everyone')

        if delete_type == 'me':
            message.deleted_for_users.add(request.user)
            return Response({"detail": "تم الحذف لديك فقط"}, status=status.HTTP_200_OK)

        if message.author != request.user and not request.user.is_superuser:
            raise PermissionDenied("لا يمكنك حذف رسالة شخص آخر للجميع.")

        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.deleted_for_everyone_by = request.user
        message.save()

        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{room_pk}',
            {
                'type': 'message_deleted',
                'message_id': message.id
            }
        )
        return Response({"detail": "تم الحذف للجميع"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='react')
    def react_message(self, request, room_pk=None, pk=None):
        message = self.get_object()
        emoji = request.data.get('emoji')
        user_id = str(request.user.id)
        user_name = request.user.full_name

        reactions = message.reactions or {}

        if reactions.get(user_id) and reactions[user_id].get('emoji') == emoji:
            del reactions[user_id]
        else:
            reactions[user_id] = {'emoji': emoji, 'name': user_name}

        message.reactions = reactions
        message.save(update_fields=['reactions'])

        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()

        async_to_sync(channel_layer.group_send)(
            f'chat_{room_pk}',
            {
                'type': 'message_reaction',
                'message_id': message.id,
                'reactions': reactions
            }
        )
        return Response({'status': 'success', 'reactions': reactions})

class ManageCustomerAddressViewSet(viewsets.ModelViewSet):
    queryset = Address.objects.all()
    serializer_class = ManagementAddressSerializer
    permission_classes = [IsManagementUser]

class AdminNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.all().select_related('user').order_by('-created_at')
    serializer_class = NotificationSerializer
    permission_classes = [IsManagementUser]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        notifications = self.get_queryset()
        grouped_notifs = []
        seen_keys = {}

        for notif in notifications:
            time_key = notif.created_at.strftime("%Y-%m-%d %H:%M")
            key = f"{notif.title}_{notif.message}_{time_key}"

            if key not in seen_keys:
                data = {
                    'id': notif.id,
                    'title': notif.title,
                    'message': notif.message,
                    'category': notif.category,
                    'is_read': notif.is_read,
                    'created_at': notif.created_at,
                    'user_id': notif.user_id,
                    'user_name': notif.user.full_name if notif.user else None,
                    'user_phone': notif.user.phone if notif.user else None,
                    'is_global': False
                }
                seen_keys[key] = data
                grouped_notifs.append(data)
            else:
                if seen_keys[key]['user_id'] != notif.user_id:
                    seen_keys[key]['is_global'] = True
                    seen_keys[key]['user_name'] = None
                    seen_keys[key]['user_phone'] = None

        return Response(grouped_notifs)

class SpecialRequestViewSet(viewsets.ModelViewSet):
    queryset = SpecialRequest.objects.select_related('user', 'sourced_animal').all()
    serializer_class = SpecialRequestSerializer

    def get_permissions(self):
        return [IsManagementUser(), HasPermission('orders.view_specialrequest')]

    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def create(self, request, *args, **kwargs):
        mutable_data = request.data.copy()

        customer_phone = mutable_data.get('customer_phone')
        customer_name = mutable_data.get('customer_name')

        if not (customer_phone and customer_name) and 'user' not in mutable_data:
            raise ValidationError({'detail': 'Customer phone and name, or a user ID are required.'})

        if customer_phone and customer_name:
            normalized_phone = normalize_phone(customer_phone)
            if not normalized_phone:
                raise ValidationError({'detail': 'Invalid phone number format.'})

            customer, created = CustomerUser.objects.get_or_create(
                phone=normalized_phone,
                defaults={'full_name': customer_name, 'is_active': True, 'is_phone_verified': True}
            )
            if created:
                customer.set_unusable_password()
                customer.save()

            mutable_data['user'] = customer.id

        serializer = self.get_serializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], url_path='source-animal')
    def source_animal(self, request, pk=None):
        special_request = self.get_object()
        animal_id = request.data.get('animal_id')

        if not animal_id:
            raise ValidationError({'animal_id': 'Animal ID is required.'})
        try:
            animal = Animal.objects.get(id=animal_id, status='available')
        except Animal.DoesNotExist:
            raise ValidationError({'animal_id': 'Animal not found or is not available.'})

        special_request.sourced_animal = animal
        special_request.status = SpecialRequest.RequestStatus.SOURCED
        special_request.save()

        send_notification(
            user=special_request.user,
            title="تم توفير طلبك الخاص!",
            message=f"لقد قمنا بتوفير حيوان يطابق مواصفات طلبك. الكود: {animal.code}. يرجى مراجعة حسابك لإتمام الشراء.",
            category="order"
        )

        return Response(self.get_serializer(special_request).data)

    @action(detail=True, methods=['post'], url_path='source-new-animal')
    @transaction.atomic
    def source_new_animal(self, request, pk=None):
        special_request = self.get_object()

        animal_serializer = AnimalCreateSerializer(data=request.data, context={'request': request})
        animal_serializer.is_valid(raise_exception=True)

        initial_weight_kg = animal_serializer.validated_data.pop('initial_weight_kg')
        initial_weight_date = animal_serializer.validated_data.pop('initial_weight_date', date.today())
        additional_images = animal_serializer.validated_data.pop('images', [])

        animal = animal_serializer.save()

        WeightLog.objects.create(
            animal=animal,
            date=initial_weight_date,
            weight_kg=initial_weight_kg,
            recorded_by=request.user
        )
        for image_file in additional_images:
            AnimalImage.objects.create(animal=animal, image=image_file)

        special_request.sourced_animal = animal
        special_request.status = SpecialRequest.RequestStatus.SOURCED
        special_request.save()

        send_notification(
            user=special_request.user,
            title="تم توفير طلبك الخاص!",
            message=f"لقد قمنا بتوفير حيوان يطابق مواصفات طلبك. الكود: {animal.code}. يرجى مراجعة حسابك لإتمام الشراء.",
            category="order"
        )

        return Response(self.get_serializer(special_request).data, status=status.HTTP_201_CREATED)

class AdvancedReportAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request, *args, **kwargs):
        report_type = request.query_params.get('type')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        start_date = None
        end_date = None

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        if report_type == 'customers_list':
            return self.get_customers_list(start_date, end_date)
        elif report_type == 'employees_list':
            return self.get_employees_list(start_date, end_date)
        elif report_type == 'fcr_analysis':
            return self.get_fcr_analysis(start_date, end_date)
        elif report_type == 'weight_gain':
            return self.get_weight_gain(start_date, end_date)
        elif report_type == 'animal_profitability':
            return self.get_animal_profitability(start_date, end_date)
        elif report_type == 'mortality':
            return self.get_mortality_report(start_date, end_date)
        elif report_type == 'health_status':
            return self.get_health_status(start_date, end_date)
        elif report_type == 'feed_forecast':
            return Response(calculate_feed_depletion_forecast())
        elif report_type == 'stock_movement':
            return self.get_stock_movement(start_date, end_date)
        elif report_type == 'waste_loss':
            return self.get_waste_loss(start_date, end_date)
        elif report_type == 'sales_by_source':
            return self.get_sales_by_source(start_date, end_date)
        elif report_type == 'sales_by_category':
            return self.get_sales_by_category(start_date, end_date)
        elif report_type == 'outstanding_payments':
            return self.get_outstanding_payments()
        elif report_type == 'top_customers':
            return self.get_customer_analytics(start_date, end_date)
        elif report_type == 'geo_distribution':
            return self.get_geo_distribution()
        elif report_type == 'pnl_statement':
            return self.get_pnl_statement(start_date, end_date)
        elif report_type == 'expenses_breakdown':
            return self.get_expenses_breakdown(start_date, end_date)
        elif report_type == 'supplier_ledger':
            return self.get_supplier_ledger(start_date, end_date)
        elif report_type == 'shares_status':
            return self.get_shares_status()
        elif report_type == 'slaughter_distribution':
            return self.get_slaughter_distribution(start_date, end_date)
        elif report_type == 'payroll_summary':
            return self.get_payroll_summary(start_date, end_date)
        elif report_type == 'audit_log':
            return self.get_audit_log(start_date, end_date)
        elif report_type == 'customer_analytics':
            return self.get_customer_analytics(start_date, end_date)
        elif report_type == 'livestock_analytics':
            return self.get_livestock_analytics(start_date, end_date)

        return Response({"error": f"Invalid report type: {report_type}"}, status=400)

    def get_fcr_analysis(self, start_date, end_date):
        animals = Animal.objects.filter(status__in=['available', 'reserved', 'sold'])
        data = []
        for animal in animals:
            total_feed = FeedingLog.objects.filter(animal=animal).aggregate(sum=Sum('quantity_kg'))['sum'] or 0
            initial = WeightLog.objects.filter(animal=animal).order_by('date').first()
            current = WeightLog.objects.filter(animal=animal).order_by('-date').first()

            if initial and current and initial != current:
                gain = current.weight_kg - initial.weight_kg
                if gain > 0:
                    fcr = float(total_feed) / float(gain)
                    data.append({
                        "code": animal.code,
                        "category": animal.category.name_ar,
                        "feed_consumed": total_feed,
                        "weight_gain": gain,
                        "fcr": round(fcr, 2)
                    })
        return Response(data)

    def get_weight_gain(self, start_date, end_date):
        logs = WeightLog.objects.all()
        if start_date:
            logs = logs.filter(date__gte=start_date)
        if end_date:
            logs = logs.filter(date__lte=end_date)

        chart_data = logs.annotate(month=TruncMonth('date')).values('month').annotate(
            avg_weight=Avg('weight_kg')
        ).order_by('month')

        return Response([{"date": d['month'].strftime('%Y-%m') if d['month'] else 'N/A', "avg_weight": d['avg_weight']} for d in chart_data])

    def get_animal_profitability(self, start_date, end_date):
        sold_animals = Animal.objects.filter(status='sold')
        if start_date:
            sold_animals = sold_animals.filter(updated_at__date__gte=start_date)

        data = []
        for animal in sold_animals:
            try:
                res = calculate_animal_profitability(animal)
                if "error" not in res:
                    data.append({
                        "code": animal.code,
                        "cost": res['total_cost'],
                        "revenue": res['sale_price'],
                        "profit": res['net_profit']
                    })
            except:
                continue
        return Response(data)

    def get_mortality_report(self, start_date, end_date):
        dead_animals = Animal.objects.filter(status='lost')
        if start_date:
            dead_animals = dead_animals.filter(updated_at__date__gte=start_date)

        data = []
        for animal in dead_animals:
            cause = HealthLog.objects.filter(animal=animal).order_by('-log_date').first()
            data.append({
                "code": animal.code,
                "category": animal.category.name_ar,
                "date": animal.updated_at.date(),
                "cost_loss": animal.purchase_price,
                "cause": cause.description if cause else "غير محدد"
            })
        return Response(data)

    def get_health_status(self, start_date, end_date):
        logs = HealthLog.objects.select_related('animal').order_by('-log_date')
        if start_date:
            logs = logs.filter(log_date__gte=start_date)

        data = [
            {
                "date": l.log_date,
                "animal": l.animal.code,
                "type": l.get_log_type_display(),
                "description": l.description,
                "cost": l.cost
            } for l in logs
        ]
        return Response(data)

    def get_stock_movement(self, start_date, end_date):
        moves = StockMovement.objects.select_related('item', 'user').order_by('-timestamp')
        if start_date:
            moves = moves.filter(timestamp__date__gte=start_date)
        if end_date:
            moves = moves.filter(timestamp__date__lte=end_date)

        data = [
            {
                "date": m.timestamp.date(),
                "item": m.item.name,
                "type": m.get_movement_type_display(),
                "qty": m.quantity,
                "user": m.user.full_name if m.user else '-'
            } for m in moves
        ]
        return Response(data)

    def get_waste_loss(self, start_date, end_date):
        moves = StockMovement.objects.filter(movement_type='adjustment_out').select_related('item')
        if start_date:
            moves = moves.filter(timestamp__date__gte=start_date)

        data = [
            {
                "date": m.timestamp.date(),
                "item": m.item.name,
                "qty_lost": m.quantity,
                "reason": m.notes
            } for m in moves
        ]
        return Response(data)

    def get_sales_by_source(self, start_date, end_date):
        orders = Order.objects.filter(status='completed')
        if start_date:
            orders = orders.filter(created_at__date__gte=start_date)

        stats = orders.values('source').annotate(
            total=Sum('total_price'),
            count=Count('id')
        )

        source_map = {'online_store': 'المتجر الإلكتروني', 'on_farm': 'نقطة بيع'}
        data = [{"source": source_map.get(s['source'], s['source']), "count": s['count'], "value": s['total']} for s in stats]
        return Response(data)

    def get_sales_by_category(self, start_date, end_date):
        return self.get_livestock_analytics(start_date, end_date)

    def get_outstanding_payments(self):
        orders = Order.objects.filter(remaining_amount__gt=0).select_related('user')
        data = [
            {
                "order_id": o.id,
                "customer": o.user.full_name,
                "phone": o.user.phone,
                "total": o.total_price,
                "paid": o.deposit_total,
                "due": o.remaining_amount
            } for o in orders
        ]
        return Response(data)

    def get_geo_distribution(self):
        return self.get_customer_analytics(None, None)

    def get_pnl_statement(self, start_date, end_date):
        revenue_accs = Account.objects.filter(account_type='REVENUE')
        expense_accs = Account.objects.filter(account_type__in=['EXPENSE', 'COGS'])

        revenue = sum(acc.get_balance(start_date, end_date) for acc in revenue_accs)
        expenses = sum(acc.get_balance(start_date, end_date) for acc in expense_accs)

        return Response({
            "total_revenue": revenue,
            "total_expenses": expenses,
            "net_profit": revenue - expenses,
            "details": [
                {
                    "account": a.name,
                    "amount": a.get_balance(start_date, end_date),
                    "type": a.account_type
                } for a in list(revenue_accs) + list(expense_accs)
            ]
        })

    def get_expenses_breakdown(self, start_date, end_date):
        expense_accs = Account.objects.filter(account_type='EXPENSE')
        data = [
            {
                "name": acc.name,
                "value": acc.get_balance(start_date, end_date)
            } for acc in expense_accs
        ]
        return Response([d for d in data if d['value'] > 0])

    def get_supplier_ledger(self, start_date, end_date):
        pos = PurchaseOrder.objects.filter(status='received').values('supplier__name').annotate(
            total_purchased=Sum(
                F('items__quantity') * F('items__unit_price'),
                output_field=DecimalField()
            )
        )
        return Response(pos)

    def get_shares_status(self):
        animals = Animal.objects.filter(is_shareable=True)
        data = []
        for a in animals:
            rem = a.remaining_shares
            status = 'مكتملة' if rem == 0 else 'جارية'
            data.append({
                "code": a.code,
                "category": a.category.name_ar,
                "total_shares": a.max_shares,
                "sold_shares": a.max_shares - rem,
                "status": status
            })
        return Response(data)

    def get_slaughter_distribution(self, start_date, end_date):
        orders = Order.objects.filter(has_slaughter_service=True, status__in=['confirmed', 'preparing', 'shipped', 'completed'])
        if start_date:
            orders = orders.filter(delivery_date__gte=start_date)

        data = [
            {
                "order_id": o.id,
                "customer": o.user.full_name,
                "delivery_date": o.delivery_date,
                "type": o.get_delivery_type_display()
            } for o in orders
        ]
        return Response(data)

    def get_payroll_summary(self, start_date, end_date):
        payrolls = Payroll.objects.all()
        if start_date:
            payrolls = payrolls.filter(
                year__gte=start_date.year,
                month__gte=start_date.month
            )

        data = [
            {
                "employee": p.employee.full_name,
                "month": f"{p.month}/{p.year}",
                "net_salary": p.net_salary,
                "status": "مدفوع" if p.is_paid else "معلق"
            } for p in payrolls
        ]
        return Response(data)

    def get_audit_log(self, start_date, end_date):
        logs = []

        status_logs = EmployeeStatusLog.objects.all()
        salary_logs = SalaryChangeLog.objects.all()
        discount_logs = DiscountLog.objects.all()

        if start_date:
            status_logs = status_logs.filter(timestamp__date__gte=start_date)
            salary_logs = salary_logs.filter(timestamp__date__gte=start_date)
            discount_logs = discount_logs.filter(timestamp__date__gte=start_date)

        for l in status_logs:
            logs.append({
                "date": l.timestamp,
                "user": l.changed_by.full_name if l.changed_by else 'System',
                "action": f"تغيير حالة موظف: {l.employee.full_name} -> {l.status}"
            })
        for l in salary_logs:
            logs.append({
                "date": l.timestamp,
                "user": l.changed_by.full_name if l.changed_by else 'System',
                "action": f"تغيير راتب: {l.employee.full_name}"
            })
        for l in discount_logs:
            logs.append({
                "date": l.timestamp,
                "user": l.changed_by.full_name if l.changed_by else 'System',
                "action": f"تغيير خصم: {l.notes}"
            })

        logs.sort(key=lambda x: x['date'], reverse=True)
        return Response(logs)

    def get_customers_list(self, start_date, end_date):
        customers = CustomerUser.objects.filter(is_superuser=False, is_staff=False)
        if start_date:
            customers = customers.filter(date_joined__date__gte=start_date)
        if end_date:
            customers = customers.filter(date_joined__date__lte=end_date)

        customers = customers.prefetch_related('addresses')
        data = []
        for c in customers:
            address = c.addresses.filter(is_default=True).first()
            addr_str = f"{address.governorate}, {address.city}" if address else "غير محدد"
            data.append({
                "name": c.full_name,
                "phone": c.phone,
                "email": c.email or "N/A",
                "address": addr_str,
                "joined_date": c.date_joined.strftime("%Y-%m-%d"),
                "status": "موقوف" if c.is_suspended else "نشط",
                "is_phone_verified": "نعم" if c.is_phone_verified else "لا",
                "phone_verified_at": c.phone_verified_at.strftime("%Y-%m-%d %I:%M %p") if c.phone_verified_at else "غير مسجل"
            })
        return Response(data)

    def get_employees_list(self, start_date, end_date):
        employees = Employee.objects.all().select_related('department', 'role')
        if start_date:
            employees = employees.filter(hire_date__gte=start_date)
        if end_date:
            employees = employees.filter(hire_date__lte=end_date)

        data = []
        for emp in employees:
            data.append({
                "name": emp.full_name,
                "phone": emp.phone,
                "department": emp.department.name if emp.department else "N/A",
                "role": emp.role.name if emp.role else "N/A",
                "salary": emp.base_salary,
                "hire_date": emp.hire_date,
                "status": "نشط" if emp.is_active else "غير نشط"
            })
        return Response(data)

    def get_customer_analytics(self, start_date, end_date):
        users_qs = CustomerUser.objects.all()
        orders_qs = Order.objects.filter(status='completed')
        if start_date:
            users_qs = users_qs.filter(date_joined__date__gte=start_date)
            orders_qs = orders_qs.filter(created_at__date__gte=start_date)
        if end_date:
            users_qs = users_qs.filter(date_joined__date__lte=end_date)
            orders_qs = orders_qs.filter(created_at__date__lte=end_date)

        gov_stats = Address.objects.filter(user__in=users_qs).values('governorate').annotate(
            count=Count('user', distinct=True)
        ).order_by('-count')

        top_customers = orders_qs.values(
            'user__full_name', 'user__phone'
        ).annotate(
            total_spent=Sum('total_price'),
            orders_count=Count('id')
        ).order_by('-total_spent')[:10]

        return Response({
            "governorate_stats": gov_stats,
            "top_customers": top_customers
        })

    def get_livestock_analytics(self, start_date, end_date):
        items_qs = OrderItem.objects.filter(order__status='completed')
        orders_qs = Order.objects.filter(status='completed')

        if start_date:
            items_qs = items_qs.filter(order__created_at__date__gte=start_date)
            orders_qs = orders_qs.filter(created_at__date__gte=start_date)
        if end_date:
            items_qs = items_qs.filter(order__created_at__date__lte=end_date)
            orders_qs = orders_qs.filter(created_at__date__lte=end_date)

        fastest_selling = items_qs.values(
            'animal__category__name_ar'
        ).annotate(
            avg_days_to_sell=Avg(
                ExpressionWrapper(
                    F('order__created_at') - F('animal__created_at'),
                    output_field=DurationField()
                )
            )
        ).order_by('avg_days_to_sell')

        fastest_data = []
        for item in fastest_selling:
            days = item['avg_days_to_sell'].days if item['avg_days_to_sell'] else 0
            fastest_data.append({
                "category": item['animal__category__name_ar'],
                "avg_days": days
            })

        popular_categories = items_qs.values('animal__category__name_ar').annotate(
            count=Count('id')
        ).order_by('-count')

        payment_methods = orders_qs.values('payment_method').annotate(
            count=Count('id')
        ).order_by('-count')

        payment_data = []
        method_map = {'cash': 'كاش', 'card': 'فيزا/أونلاين', 'paymob': 'أونلاين'}
        for pm in payment_methods:
            payment_data.append({
                "method": method_map.get(pm['payment_method'], pm['payment_method']),
                "count": pm['count']
            })

        sales_source = orders_qs.values('source').annotate(
            count=Count('id')
        ).order_by('-count')

        source_data = []
        source_map = {'online_store': 'المتجر الإلكتروني', 'on_farm': 'نقطة بيع (المزرعة)'}
        for src in sales_source:
            source_data.append({
                "source": source_map.get(src['source'], src['source']),
                "count": src['count']
            })

        most_sold_weights_raw = items_qs\
            .annotate(
                weight_group=Floor(F('animal__weight_logs__weight_kg') / 10) * 10
            ).values('weight_group').annotate(count=Count('id')).order_by('-count')[:5]

        weight_data = []
        for w in most_sold_weights_raw:
            if w['weight_group']:
                weight_data.append({
                    "weight_range": f"{int(w['weight_group'])}-{int(w['weight_group'])+10} كجم",
                    "count": w['count']
                })

        return Response({
            "fastest_selling": fastest_data,
            "popular_categories": popular_categories,
            "payment_methods": payment_data,
            "sales_source": source_data,
            "most_sold_weights": weight_data
        })

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by('-is_active', 'name')
    serializer_class = VehicleSerializer
    permission_classes = [IsManagementUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active']

class FarmPrepView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        tasks = Order.objects.filter(
            status='confirmed',
            items__animal__source_farm__isnull=True
        ).distinct().prefetch_related('items__animal')
        serializer = ManagementOrderSerializer(tasks, many=True)
        return Response(serializer.data)

    def patch(self, request, order_id=None):
        order = get_object_or_404(Order, id=order_id)
        op_settings = OperationSettings.load()

        if order.has_slaughter_service:
            order.status = 'processing'
        else:
            if op_settings.enable_fridge_manager:
                order.status = 'packaging'
            else:
                order.status = 'ready_for_shipment'

        order.save(update_fields=['status'])
        return Response({"status": "success"})

class ButcherScreenView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        op_settings = OperationSettings.load()
        if not op_settings.enable_internal_slaughter:
            return Response([])

        tasks = Order.objects.filter(
            status='processing',
            has_slaughter_service=True
        ).prefetch_related('items__animal')

        serializer = ManagementOrderSerializer(tasks, many=True)
        return Response(serializer.data)

    def post(self, request, order_id=None):
        order = get_object_or_404(Order, id=order_id)
        op_settings = OperationSettings.load()

        if op_settings.enable_fridge_manager:
            order.status = 'packaging'
        else:
            order.status = 'ready_for_shipment'

        order.save(update_fields=['status'])
        return Response({"status": "success"})

class FridgeManagerView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        op_settings = OperationSettings.load()
        if not op_settings.enable_fridge_manager:
            return Response([])

        tasks = Order.objects.filter(
            status='packaging'
        ).prefetch_related('items__animal')

        serializer = ManagementOrderSerializer(tasks, many=True)
        return Response(serializer.data)

    def patch(self, request, order_id=None):
        order = get_object_or_404(Order, id=order_id)
        order.status = 'ready_for_shipment'
        order.save(update_fields=['status'])
        return Response({"status": "success"})

class DispatcherView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        op_settings = OperationSettings.load()

        deliveries = Order.objects.filter(
            status='ready_for_shipment',
            shipment__isnull=True
        ).select_related('user', 'delivery_address')

        pickups = Order.objects.filter(
            status='confirmed',
            items__animal__source_farm__isnull=False
        ).distinct().select_related('user')

        external_slaughter = Order.objects.none()
        if not op_settings.enable_internal_slaughter:
            external_slaughter = Order.objects.filter(
                status='processing',
                has_slaughter_service=True
            ).select_related('user')

        grouped_deliveries = {}
        for order in deliveries:
            gov = order.delivery_address.governorate if order.delivery_address else "استلام من المزرعة"
            if gov not in grouped_deliveries:
                grouped_deliveries[gov] = []
            grouped_deliveries[gov].append(ManagementOrderSerializer(order).data)

        active_shipments = Shipment.objects.filter(status__in=['pending', 'out_for_delivery']).select_related('vehicle', 'supervisor')
        completed_shipments = Shipment.objects.filter(status='completed').select_related('vehicle', 'supervisor').order_by('-date')[:30]

        return Response({
            "deliveries": grouped_deliveries,
            "pickups": ManagementOrderSerializer(pickups, many=True).data,
            "external_slaughter": ManagementOrderSerializer(external_slaughter, many=True).data,
            "active_shipments": ShipmentSerializer(active_shipments, many=True).data,
            "completed_shipments": ShipmentSerializer(completed_shipments, many=True).data
        })

    def patch(self, request, order_id=None):
        order = get_object_or_404(Order, id=order_id)
        action = request.data.get('action')
        op_settings = OperationSettings.load()

        if action == 'pickup_completed':
            if order.has_slaughter_service:
                order.status = 'processing'
            else:
                order.status = 'packaging' if op_settings.enable_fridge_manager else 'ready_for_shipment'

        elif action == 'slaughter_completed':
            order.status = 'packaging' if op_settings.enable_fridge_manager else 'ready_for_shipment'

        order.save(update_fields=['status'])
        return Response({"status": "success"})

class DriverAppView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        active_shipment = Shipment.objects.filter(
            supervisor=request.user,
            status='out_for_delivery'
        ).prefetch_related('orders__user', 'orders__delivery_address', 'orders__items__animal').first()

        if not active_shipment:
            return Response({"detail": "لا توجد رحلات نشطة لك حالياً."}, status=404)

        serializer = ShipmentSerializer(active_shipment)
        return Response(serializer.data)

class OperationSettingsView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        settings = OperationSettings.load()
        return Response(OperationSettingsSerializer(settings).data)

    def post(self, request):
        settings = OperationSettings.load()
        serializer = OperationSettingsSerializer(settings, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AttendanceLogViewSet(viewsets.ModelViewSet):
    queryset = AttendanceLog.objects.all().order_by('-date', '-created_at')
    serializer_class = AttendanceLogSerializer
    permission_classes = [IsManagementUser]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.all().order_by('-timestamp')
    permission_classes = [IsManagementUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return StockMovementCreateSerializer
        return StockMovementCreateSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class DailyReconciliationView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        date_str = request.query_params.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = timezone.now().date()

        sales_reconciliation = []
        sales_employees = Order.objects.filter(
            created_at__date=target_date,
            source='on_farm'
        ).values('created_by_employee__id', 'created_by_employee__full_name').distinct()

        for emp in sales_employees:
            emp_id = emp['created_by_employee__id']
            name = emp['created_by_employee__full_name']
            emp_orders = Order.objects.filter(created_at__date=target_date, created_by_employee_id=emp_id)
            total_orders = emp_orders.count()
            cash_collected = emp_orders.filter(payment_method='cash').aggregate(sum=Sum('deposit_total'))['sum'] or 0
            digital_collected = emp_orders.exclude(payment_method='cash').aggregate(sum=Sum('deposit_total'))['sum'] or 0

            sales_reconciliation.append({
                'employee_name': name,
                'total_orders': total_orders,
                'cash_in_hand': cash_collected,
                'digital_sales': digital_collected,
                'orders_list': emp_orders.values('id', 'total_price', 'payment_method')
            })

        drivers_reconciliation = []

        delivered_orders = Order.objects.filter(
            status='delivered',
            updated_at__date=target_date,
            delivery_type='delivery'
        ).select_related('shipment', 'shipment__vehicle', 'user').prefetch_related('payments')

        shipments_map = {}

        for order in delivered_orders:
            shipment_id = order.shipment.id if order.shipment else 'بدون-رحلة'
            driver_name = order.shipment.driver_name if order.shipment else "توصيل خارجي"

            if shipment_id not in shipments_map:
                vehicle = order.shipment.vehicle.name if (order.shipment and order.shipment.vehicle) else ""
                shipments_map[shipment_id] = {
                    'shipment_id': shipment_id,
                    'driver_name': driver_name,
                    'vehicle': vehicle,
                    'total_cash_collected': 0,
                    'total_pos_collected': 0,
                    'paperwork': []
                }

            driver_payments = order.payments.filter(
                payment_type='remainder',
                status='completed',
                created_at__date=target_date
            )

            order_cash = 0
            order_pos = 0

            for payment in driver_payments:
                if payment.payment_method == 'pos':
                    order_pos += float(payment.amount)
                elif payment.payment_method == 'cash':
                    order_cash += float(payment.amount)

            shipments_map[shipment_id]['total_cash_collected'] += order_cash
            shipments_map[shipment_id]['total_pos_collected'] += order_pos

            shipments_map[shipment_id]['paperwork'].append({
                'order_id': order.id,
                'customer_name': order.user.full_name,
                'amount_collected': order_cash + order_pos,
                'is_pos': order_pos > 0,
                'doc_name': f"إيصال طلب #{order.id} ",
                'has_image': bool(order.signed_receipt_image)
            })

        drivers_reconciliation = list(shipments_map.values())

        return Response({
            'date': target_date,
            'sales_reconciliation': sales_reconciliation,
            'drivers_reconciliation': drivers_reconciliation
        })

class JobOpeningViewSet(viewsets.ModelViewSet):
    queryset = JobOpening.objects.all().order_by('-created_at')
    serializer_class = JobOpeningSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsManagementUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_staff:
            today = date.today()
            queryset = queryset.filter(
                is_active=True,
            ).filter(Q(deadline__isnull=True) | Q(deadline__gte=today))
        return queryset

class JobApplicationViewSet(viewsets.ModelViewSet):
    queryset = JobApplication.objects.all().order_by('-created_at')
    serializer_class = JobApplicationSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsManagementUser()]

class ShiftSummaryView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        current_employee = request.user
        today = timezone.now().date()

        orders = Order.objects.filter(
            created_at__date=today,
            source='on_farm',
            created_by_employee=current_employee
        ).exclude(status='canceled')

        total_sales = orders.aggregate(total=Sum('deposit_total'))['total'] or 0

        cash_sales = orders.filter(payment_method='cash').aggregate(total=Sum('deposit_total'))['total'] or 0

        card_sales = orders.exclude(payment_method='cash').aggregate(total=Sum('deposit_total'))['total'] or 0

        return Response({
            "employee_name": current_employee.full_name,
            "total": total_sales,
            "cash": cash_sales,
            "card": card_sales,
            "order_count": orders.count(),
            "date": today
        })

class DeliveryAreaViewSet(viewsets.ModelViewSet):
    queryset = DeliveryArea.objects.all().select_related('governorate').order_by('governorate__name_ar')
    serializer_class = ManagementDeliveryAreaSerializer
    permission_classes = [IsManagementUser]
    pagination_class = None

class ContactMessageViewSet(viewsets.ModelViewSet):
    queryset = ContactMessage.objects.all().order_by('-created_at')
    serializer_class = ContactMessageSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsManagementUser()]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated and hasattr(self.request.user, 'customeruser') else None
        msg = serializer.save(user=user)

        try:
            if send_admin_notification:
                send_admin_notification(
                    title="رسالة تواصل جديدة",
                    message=f"تلقيت رسالة جديدة من {msg.name} بخصوص: {msg.subject}",
                    category="general"
                )
        except Exception as e:
            print(f"Failed to send admin notification: {e}")

class CustomerCallLogViewSet(viewsets.ModelViewSet):
    queryset = CustomerCallLog.objects.all().select_related('handled_by').order_by('-start_time')
    serializer_class = CustomerCallLogSerializer
    permission_classes = [IsManagementUser]

    def perform_create(self, serializer):
        start = serializer.validated_data.get('start_time')
        end = serializer.validated_data.get('end_time')
        duration = 0
        if start and end:
            duration = int((end - start).total_seconds())

        phone = serializer.validated_data.get('customer_phone')
        normalized_phone = normalize_phone(phone) or phone

        serializer.save(
            handled_by=self.request.user,
            duration_seconds=duration,
            customer_phone=normalized_phone
        )

class DocumentArchiveViewSet(viewsets.ModelViewSet):
    queryset = DocumentArchive.objects.all().order_by('-created_at')
    serializer_class = DocumentArchiveSerializer
    permission_classes = [IsManagementUser]

    def get_queryset(self):
        qs = super().get_queryset()
        doc_type = self.request.query_params.get('document_type')
        supplier_id = self.request.query_params.get('supplier')
        b2b_id = self.request.query_params.get('b2b_customer')
        order_id = self.request.query_params.get('order')
        employee_id = self.request.query_params.get('employee_file')
        business_req_id = self.request.query_params.get('business_request')

        if doc_type:
            qs = qs.filter(document_type=doc_type)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        if b2b_id:
            qs = qs.filter(b2b_customer_id=b2b_id)
        if order_id:
            qs = qs.filter(order_id=order_id)
        if employee_id:
            qs = qs.filter(employee_file_id=employee_id)
        if business_req_id:
            qs = qs.filter(business_request_id=business_req_id)

        return qs

class CorporateCustomersAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        customers = CustomerUser.objects.filter(is_corporate=True).values('id', 'business_name', 'full_name', 'phone')
        data = [{'id': c['id'], 'name': c['business_name'] or c['full_name'], 'phone': c['phone']} for c in customers]
        return Response(data)

class SmartActionPlanView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.localtime(timezone.now()).date()
        tomorrow = today + timedelta(days=1)

        active_orders = Order.objects.filter(
            status__in=['confirmed', 'processing', 'ready_for_shipment']
        ).exclude(source='b2b').select_related(
            'user', 'delivery_address'
        ).prefetch_related(
            'items__animal__category', 'items__animal__source_farm'
        ).order_by('delivery_date')

        def create_plan_template():
            return {
                'suppliers': {},
                'slaughter': [],
                'live': [],
                'deliveries': [],
                'pickups': []
            }

        plan = {
            'late': create_plan_template(),
            'today': create_plan_template(),
            'tomorrow': create_plan_template(),
            'upcoming_count': 0,
            'unscheduled_count': 0
        }

        for order in active_orders:
            target_plan = None
            if not order.delivery_date:
                plan['unscheduled_count'] += 1
                continue
            elif order.delivery_date < today:
                target_plan = plan['late']
            elif order.delivery_date == today:
                target_plan = plan['today']
            elif order.delivery_date == tomorrow:
                target_plan = plan['tomorrow']
            else:
                plan['upcoming_count'] += 1
                continue

            if order.delivery_type == 'delivery' and order.delivery_address:
                address = f"{order.delivery_address.governorate} - {order.delivery_address.city} - {order.delivery_address.street}"
                target_plan['deliveries'].append({
                    "order_id": order.id,
                    "customer": order.user.full_name,
                    "phone": order.user.phone,
                    "address": address
                })
            else:
                target_plan['pickups'].append({
                    "order_id": order.id,
                    "customer": order.user.full_name,
                    "phone": order.user.phone
                })

            for item in order.items.all():
                animal = item.animal
                animal_info = {
                    "code": animal.code,
                    "category": animal.category.name_ar if animal.category else "ماشية",
                    "order_id": order.id,
                    "share": f"{item.share_quantity} أسهم" if item.share_quantity > 1 else "كامل"
                }

                if animal.source_farm:
                    sup_id = animal.source_farm.id
                    if sup_id not in target_plan['suppliers']:
                        target_plan['suppliers'][sup_id] = {
                            "name": animal.source_farm.name,
                            "phone": animal.source_farm.phone,
                            "animals": []
                        }
                    target_plan['suppliers'][sup_id]['animals'].append(animal_info)

                if item.selected_services and item.selected_services.get('slaughter'):
                    target_plan['slaughter'].append(animal_info)
                else:
                    target_plan['live'].append(animal_info)

        plan['late']['suppliers'] = list(plan['late']['suppliers'].values())
        plan['today']['suppliers'] = list(plan['today']['suppliers'].values())
        plan['tomorrow']['suppliers'] = list(plan['tomorrow']['suppliers'].values())

        from livestock.models import AnimalListing
        from orders.models import OrderItem

        shared_listings = AnimalListing.objects.filter(
            total_shares__gt=1
        ).select_related('animal', 'animal__category')

        shared_animals_status =[]
        valid_statuses =['pending', 'confirmed', 'processing', 'ready_for_shipment', 'out_for_delivery', 'delivered', 'completed']

        section_map = {
            'full_sale': 'بيع كامل',
            'adahi_pool': 'مسبح أضاحي عام',
            'adahi_full': 'أضحية كاملة',
            'adahi_group': 'مجموعة خاصة',
            'shares': 'تشارك لحم'
        }

        for listing in shared_listings:
            items = OrderItem.objects.filter(
                animal=listing.animal,
                listing_section=listing.section,
                order__status__in=valid_statuses
            ).select_related('order__user')

            if items.exists():
                participants =[]
                sold_shares = 0

                for item in items:
                    participants.append({
                        "customer_name": item.order.user.full_name,
                        "order_id": item.order.id,
                        "shares_bought": item.share_quantity
                    })
                    sold_shares += item.share_quantity

                remaining = max(0, listing.total_shares - sold_shares)

                has_active_work = items.filter(order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment']).exists()

                if remaining > 0 or has_active_work:
                    shared_animals_status.append({
                        "animal_code": listing.animal.code,
                        "category": listing.animal.category.name_ar if listing.animal.category else "غير محدد",
                        "section": section_map.get(listing.section, listing.section),
                        "total_shares": listing.total_shares,
                        "available_shares": remaining,
                        "sold_shares": sold_shares,
                        "participants": participants,
                        "is_complete": remaining == 0
                    })

        return Response({
            "plan": plan,
            "total_active_orders": active_orders.count(),
            "shared_animals_status": shared_animals_status
        })

class RecentOrdersAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        orders = Order.objects.exclude(source='b2b').order_by('-id')[:200].values('id', 'user__full_name', 'source')
        data = []
        for o in orders:
            name_suffix = " [نقطة بيع]" if o['source'] == 'on_farm' else ""
            data.append({
                'id': o['id'],
                'customer_name': f"{o['user__full_name']}{name_suffix}"
            })
        return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_driver_location(request, shipment_id):
    try:
        shipment = Shipment.objects.get(id=shipment_id, supervisor=request.user)
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        now = timezone.now()

        history = shipment.history_log or []
        last_loc_log = next((h for h in reversed(history) if h.get("action") == "تحديث موقع السائق"), None)
        should_log = True
        if last_loc_log:
            last_time = datetime.fromisoformat(last_loc_log["time"])
            if (now - last_time).total_seconds() < 1800:
                should_log = False

        if should_log:
            history.append({
                "time": now.isoformat(),
                "action": "تحديث موقع السائق",
                "location": f"Lat: {lat}, Lng: {lng}"
            })
            shipment.history_log = history

        shipment.last_lat = lat
        shipment.last_lng = lng
        shipment.last_location_update = now
        shipment.save(update_fields=['last_lat', 'last_lng', 'last_location_update', 'history_log'])
        return Response({"status": "success"})
    except Shipment.DoesNotExist:
        return Response({"error": "الرحلة غير موجودة"}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def advance_shipment_step(request, shipment_id):
    shipment = get_object_or_404(Shipment, id=shipment_id, supervisor=request.user)
    route = shipment.route_plan or []
    if shipment.current_step_index < len(route):
        current_task = route[shipment.current_step_index]
        order_id = current_task.get('order_id')
        task_type = current_task.get('type')

        if order_id:
            order = get_object_or_404(Order, id=order_id)
            if task_type == 'pickup':
                order.notes = (order.notes or '') + "\n[تم جلب الحيوان من المورد بنجاح]"
                order.status = 'processing' if order.has_slaughter_service else 'ready_for_shipment'
            elif task_type == 'slaughter':
                order.notes = (order.notes or '') + "\n[تم ذبح وتجهيز الطلب في المجزر]"
                order.status = 'ready_for_shipment'
            order.save()

        history = shipment.history_log or []
        history.append({
            "time": timezone.now().isoformat(),
            "action": "إنجاز محطة",
            "details": f"تم إنجاز محطة: {current_task.get('address')}"
        })
        shipment.history_log = history

        shipment.current_step_index += 1
        if shipment.current_step_index >= len(route):
            shipment.status = 'completed'
        shipment.save()
        return Response({"status": "advanced", "current_step": shipment.current_step_index})

    shipment.status = 'completed'
    shipment.save()
    return Response({"status": "already_completed", "current_step": shipment.current_step_index})