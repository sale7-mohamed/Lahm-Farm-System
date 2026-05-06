from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.contrib.auth import authenticate
from django.utils import timezone
from django.core.signing import TimestampSigner
from .models import User, OTP, Address
import requests
import pycountry
from django.utils.translation import gettext_lazy as _
from .utils import create_and_send_phone_otp, create_and_send_email_otp, get_tokens_for_customer
from .permissions import IsCustomerUser
from rest_framework.exceptions import ValidationError
from .throttling import OTPPhoneThrottle
from .serializers import (
    RegisterSerializer, VerifyOTPSerializer, CheckAccountSerializer,
    MeSerializer, UpdateProfileSerializer, RequestPasswordResetSerializer,
    VerifyPasswordResetOTPSerializer, SetNewPasswordSerializer, AddressSerializer
)
from .backends import EmailOrPhoneBackend
from rest_framework.throttling import ScopedRateThrottle

def merge_guest_cart_to_user(user, request):
    pass

class DetectCountryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import re
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')
        ip = ip.strip()

        if not re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]+$', ip):
            return Response({'country_code': '+20', 'country_name': 'Egypt'}, status=status.HTTP_400_BAD_REQUEST)

        if ip in ['127.0.0.1', '::1']:
            return Response({'country_code': '+20', 'country_name': 'Egypt'})

        try:
            response = requests.get(f'http://ip-api.com/json/{ip}?fields=countryCode', timeout=5)
            data = response.json()
            country_code = data.get('countryCode', 'EG')

            phone_code_map = {
                'EG': '+20', 'SA': '+966', 'AE': '+971', 'JO': '+962',
                'BH': '+973', 'QA': '+974', 'OM': '+968', 'SY': '+963', 'LB': '+961'
            }

            phone_code = phone_code_map.get(country_code, '+20')
            country = pycountry.countries.get(alpha_2=country_code)

            return Response({
                'country_code': phone_code,
                'country_name': country.name if country else 'Egypt'
            })

        except requests.exceptions.Timeout:
            return Response({'country_code': '+20', 'country_name': 'Egypt'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except Exception:
            return Response({'country_code': '+20', 'country_name': 'Egypt'}, status=status.HTTP_200_OK)

class CheckAccountAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = CheckAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data.get('user')
        is_email = serializer.validated_data.get('is_email')
        country_code = request.data.get('country_code', '+20')
        password_set = user.has_usable_password() if user else False

        response_data = {
            'account_exists': bool(user),
            'password_set': password_set,
            'is_email': is_email,
            'is_verified': user.is_phone_verified if user else False,
        }

        if not is_email:
            response_data['country_code'] = country_code

        return Response(response_data)

class RegisterAPIView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'detail': _('تم إنشاء الحساب بنجاح، يرجى إدخال الكود المرسل لهاتفك لتفعيله.'),
            'needs_otp': True,
            'phone': user.phone,
            'email': user.email,
        }, status=status.HTTP_201_CREATED)

class VerifyOTPAPIView(APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VerifyOTPSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        otp = serializer.validated_data['otp']
        otp_type = serializer.validated_data['otp_type']

        with transaction.atomic():
            otp.is_used = True
            otp.save()

            tokens = get_tokens_for_customer(user)
            user_info = MeSerializer(user).data
            tokens_data = {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'user_info': user_info
            }

            if otp_type == OTP.OTPType.PHONE_VERIFICATION:
                user.is_active = True
                user.is_phone_verified = True
                user.phone_verified_at = timezone.now()
                user.save(update_fields=['is_active', 'is_phone_verified', 'phone_verified_at'])

                if user.email and not user.is_email_verified:
                    return Response({
                        'detail': _('تم التحقق من رقم الهاتف بنجاح. يرجى إدخال الكود المرسل لبريدك الإلكتروني.'),
                        'email_verification_required': True,
                        'email': user.email,
                        **tokens_data
                    }, status=status.HTTP_200_OK)
                else:
                    merge_guest_cart_to_user(user, request)
                    return Response({
                        'detail': _('تم تفعيل حسابك وتسجيل دخولك بنجاح!'),
                        'verification_complete': True,
                        **tokens_data
                    }, status=status.HTTP_200_OK)

            elif otp_type == OTP.OTPType.EMAIL_VERIFICATION:
                if User.objects.exclude(pk=user.pk).filter(email__iexact=user.email, is_email_verified=True).exists():
                    user.email = None
                    user.save(update_fields=['email'])
                    return Response(
                        {"detail": _("عذراً، هذا البريد تم تفعيله للتو بواسطة حساب آخر. يرجى استخدام بريد مختلف.")},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                user.is_email_verified = True
                user.email_verified_at = timezone.now()
                user.save(update_fields=['is_email_verified', 'email_verified_at'])

                merge_guest_cart_to_user(user, request)
                return Response({
                    'detail': _('تم تفعيل بريدك الإلكتروني وتسجيل دخولك بنجاح!'),
                    'verification_complete': True,
                    **tokens_data
                }, status=status.HTTP_200_OK)

        return Response({"detail": _("حدث خطأ غير متوقع.")}, status=status.HTTP_400_BAD_REQUEST)

class ResendOTPAPIView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPPhoneThrottle]

    def post(self, request, *args, **kwargs):
        phone = request.data.get('phone')
        email = request.data.get('email')
        user = request.user if request.user.is_authenticated else None

        if not phone and not email and not user:
            raise ValidationError({"detail": _("يجب توفير رقم هاتف أو بريد إلكتروني.")})

        try:
            if phone:
                user = User.objects.get(phone=phone)
                create_and_send_phone_otp(user, OTP.OTPType.PHONE_VERIFICATION)
                return Response({"detail": _("تم إرسال كود تحقق جديد إلى هاتفك.")}, status=status.HTTP_200_OK)

            if email:
                user = User.objects.get(email__iexact=email)
                create_and_send_email_otp(user, OTP.OTPType.EMAIL_VERIFICATION)
                return Response({"detail": _("تم إرسال كود تحقق جديد إلى بريدك الإلكتروني.")}, status=status.HTTP_200_OK)

            if user and isinstance(user, User):
                if user.email and not user.is_email_verified:
                    create_and_send_email_otp(user, OTP.OTPType.EMAIL_VERIFICATION)
                    return Response({"detail": _("تم إرسال كود تحقق جديد إلى بريدك الإلكتروني المسجل.")}, status=status.HTTP_200_OK)
                else:
                    return Response({"detail": _("لا يوجد بريد إلكتروني غير مفعل لهذا الحساب.")}, status=status.HTTP_400_BAD_REQUEST)

        except User.DoesNotExist:
            return Response({"detail": _("لا يوجد حساب مرتبط بهذه البيانات.")}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            raise e
        except Exception as e:
            error_msg = str(e)
            if "الانتظار" in error_msg or "Throttled" in type(e).__name__:
                return Response({"detail": error_msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)

            return Response({"detail": _("حدث خطأ أثناء إرسال كود التحقق.")}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        identifier = request.data.get('identifier') or request.data.get('phone')
        password = request.data.get('password')

        if not identifier or not password:
            return Response(
                {"detail": _("يرجى إدخال البيانات.")},
                status=status.HTTP_400_BAD_REQUEST
            )

        backend = EmailOrPhoneBackend()
        customer = backend.authenticate(
            request=request,
            username=identifier,
            password=password
        )

        if not customer:
            return Response(
                {"detail": _("بيانات الدخول غير صحيحة.")},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if customer.is_suspended:
            reason = customer.custom_notification or customer.suspension_reason or _("تم إيقاف حسابك من قبل الإدارة.")
            return Response({"detail": reason, "code": "account_suspended"}, status=status.HTTP_403_FORBIDDEN)

        if not customer.is_active or not customer.is_phone_verified:
            create_and_send_phone_otp(customer, OTP.OTPType.PHONE_VERIFICATION)
            return Response({
                "detail": _("الحساب غير مفعل. تم إرسال كود التحقق."),
                "needs_verification": True,
                "phone": customer.phone,
                "email": customer.email
            }, status=status.HTTP_200_OK)

        try:
            tokens = get_tokens_for_customer(customer)
            user_info = MeSerializer(customer).data

            merge_guest_cart_to_user(customer, request)

            return Response({
                'refresh': tokens['refresh'],
                'access': tokens['access'],
                'user_info': user_info
            }, status=status.HTTP_200_OK)

        except Exception:
            return Response(
                {"detail": _("حدث خطأ غير متوقع أثناء معالجة البيانات.")},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MeAPIView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsCustomerUser]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UpdateProfileSerializer
        return MeSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        instance.refresh_from_db()
        response_serializer = MeSerializer(instance)
        return Response(response_serializer.data)

class RequestPasswordResetAPIView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RequestPasswordResetSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        formatted_phone = serializer.validated_data['formatted_phone']

        create_and_send_phone_otp(user, OTP.OTPType.PASSWORD_RESET)
        return Response({
            'detail': _('تم إرسال كود التحقق بنجاح'),
            'identifier': formatted_phone
        }, status=status.HTTP_200_OK)

class VerifyPasswordResetOTPAPIView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VerifyPasswordResetOTPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        otp = serializer.validated_data['otp']

        with transaction.atomic():
            otp.is_used = True
            otp.save()

        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        full_token = f"{uid}-{token}"

        return Response({
            'detail': _('تم التحقق بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.'),
            'token': full_token
        })

class SetNewPasswordAPIView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = SetNewPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']

        if user.check_password(new_password):
            raise ValidationError({"new_password": _("لا يمكن استخدام كلمة المرور القديمة.")})
        user.set_password(new_password)
        user.is_active = True
        user.is_phone_verified = True
        user.save()

        tokens = get_tokens_for_customer(user)
        user_info = MeSerializer(user).data

        return Response({
            'detail': _('تم تحديث كلمة المرور وتفعيل الحساب بنجاح.'),
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user_info': user_info
        })

class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsCustomerUser]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

