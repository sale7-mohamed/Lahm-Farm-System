# messaging/views.py
from datetime import timedelta

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User as CustomerUser
from accounts.services.otp_providers import WhySMSProvider, get_provider_instance
from core.models import OperationSettings
from management.permissions import IsManagementUser
from notifications.utils import send_global_notification, send_notification

from .models import MessageLog, MessageTemplate
from .serializers import (
    MessageLogSerializer,
    MessageTemplateSerializer,
    SendBulkSerializer,
)
from .services import MessagingService

class MessageLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MessageLog.objects.all().order_by("-created_at")
    serializer_class = MessageLogSerializer
    permission_classes = [IsManagementUser]
    pagination_class = None

class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer
    permission_classes = [IsManagementUser]

    @action(detail=False, methods=["post"])
    def init_defaults(self, request):
        defaults = [
            ("OTP", "كود التحقق الخاص بك هو: {code}"),
            (
                "ORDER_CONFIRMED",
                "مرحباً {name}، تم تأكيد طلبك رقم #{id} .",
            ),
            (
                "ORDER_SHIPPED",
                "طلبك رقم #{id}     .",
            ),
            (
                "ORDER_DELIVERED",
                "تم تسليم طلبك رقم #{id}.   .",
            ),
            (
                "DRIVER_NEAR",
                "مرحباً {name}، مندوب شركة لَحِم في الطريق إليك لتسليم طلبك. يرجى تجهيز المبلغ المتبقي ({total} ج.م) لضمان سرعة التسليم.",
            ),
        ]
        created = 0
        for key, content in defaults:
            _, flag = MessageTemplate.objects.get_or_create(
                key=key, defaults={"content": content}
            )
            if flag:
                created += 1
        return Response(
            {"created": created, "message": "تم استعادة القوالب الافتراضية بنجاح"}
        )

class SendMessageView(viewsets.ViewSet):
    permission_classes = [IsManagementUser]

    @action(detail=False, methods=["post"])
    def bulk_send(self, request):
        serializer = SendBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phones = serializer.validated_data["phones"]
        message = serializer.validated_data["message"]

        max_phones = 1000
        if len(phones) > max_phones:
            return Response(
                {"detail": f"لا يمكن إرسال أكثر من {max_phones} رقم في المرة الواحدة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent_count = MessagingService.send_bulk_manual(
            phones, message, request.user
        )
        total_phones = len(phones)

        if sent_count == 0:
            return Response(
                {
                    "detail": "فشل إرسال الرسائل لجميع الأرقام المحددة. يرجى مراجعة 'سجل SMS' لمعرفة سبب رفض المزود."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        elif sent_count < total_phones:
            failed_count = total_phones - sent_count
            return Response(
                {
                    "success": True,
                    "detail": f"تم الإرسال إلى {sent_count} أرقام بنجاح، وفشل الإرسال لـ {failed_count} أرقام.",
                }
            )
        else:
            return Response(
                {
                    "success": True,
                    "detail": f"تم الإرسال إلى جميع الأرقام ({sent_count}) بنجاح.",
                }
            )

    @action(detail=False, methods=['post'], url_path='fetch_audience_phones')
    def fetch_audience_phones(self, request):
        audience = request.data.get('audience', 'all')
        days = int(request.data.get('days', 30))

        #   (is_staff)    
        qs = CustomerUser.objects.filter(is_staff=False, is_superuser=False).exclude(phone__isnull=True).exclude(phone__exact='')

        if audience == 'has_orders':
            qs = qs.filter(orders__isnull=False)
        elif audience == 'verified':
            qs = qs.filter(is_phone_verified=True)
        elif audience == 'unverified':
            qs = qs.filter(is_phone_verified=False)
        elif audience == 'new':
            from django.utils import timezone
            from datetime import timedelta
            qs = qs.filter(date_joined__gte=timezone.now() - timedelta(days=days))

        #      (distinct)
        phones = list(qs.values_list('phone', flat=True).distinct())
        return Response({'phones': phones})

    @action(detail=False, methods=["post"], url_path="push_global")
    def push_global(self, request):
        title = request.data.get("title")
        message = request.data.get("message")
        category = request.data.get("category", "general")

        if not title or not message:
            return Response(
                {"detail": "العنوان والرسالة مطلوبان"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(title) > 100 or len(message) > 500:
            return Response(
                {
                    "detail": "العنوان أقصى طول 100 حرف، والرسالة أقصى طول 500 حرف"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        send_global_notification(title=title, message=message, category=category)

        return Response(
            {
                "success": True,
                "detail": "تم إرسال الإشعار لجميع العملاء بنجاح",
            }
        )

    @action(detail=False, methods=["post"], url_path="push_single")
    def push_single(self, request):
        phone = request.data.get("phone")
        title = request.data.get("title")
        message = request.data.get("message")
        category = request.data.get("category", "general")

        if not all([phone, title, message]):
            return Response(
                {"detail": "رقم الهاتف، العنوان والرسالة مطلوبة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(title) > 100 or len(message) > 500:
            return Response(
                {
                    "detail": "العنوان أقصى طول 100 حرف، والرسالة أقصى طول 500 حرف"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(phone) < 6:
            return Response(
                {"detail": "رقم الهاتف غير صالح"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomerUser.objects.filter(
                phone__icontains=phone[-10:]
            ).first()
            if not user:
                return Response(
                    {"detail": "لم يتم العثور على عميل مسجل بهذا الرقم"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            send_notification(
                user=user, title=title, message=message, category=category
            )

            return Response(
                {
                    "success": True,
                    "detail": f"تم إرسال الإشعار بنجاح للعميل: {user.full_name}",
                }
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class ProviderInfoView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        provider_name = request.query_params.get("provider", "whysms")
        try:
            provider = get_provider_instance(provider_name)
            info = provider.get_info()
            return Response(info)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class ProviderOperatorsView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        provider_name = request.query_params.get("provider")
        if not provider_name:
            return Response(
                {"error": "يجب تحديد اسم المزود"}, status=400
            )

        try:
            provider = get_provider_instance(provider_name)
            if hasattr(provider, "get_operators"):
                return Response(provider.get_operators())
            return Response(
                {"error": "هذا المزود لا يدعم الاستعلام عن مشغلي الشبكات"},
                status=400,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class ExternalSmsLogsView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request):
        provider_name = request.query_params.get("provider", "whysms")
        if provider_name != "whysms":
            return Response(
                {"error": "متاح فقط لـ WhySMS"}, status=400
            )

        try:
            provider = WhySMSProvider()
            info = provider.get_info()
            return Response(info)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class MessagingConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = OperationSettings.load()
        return Response(
            {
                "provider": settings.general_sms_provider,
                "otp_provider": settings.otp_provider,
            }
        )