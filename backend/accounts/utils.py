import secrets
import logging
import phonenumbers
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTP
from .phone_rules import PHONE_RULES, DEFAULT_COUNTRY
from .services.otp_service import OTPService
from messaging.models import MessageLog

logger = logging.getLogger(__name__)

def detect_country_from_ip(request):
    return getattr(settings, 'DEFAULT_PHONE_COUNTRY', DEFAULT_COUNTRY)

def validate_phone_with_country(country_code, raw_phone):
    try:
        pn = phonenumbers.parse(raw_phone, country_code)
        rule = PHONE_RULES.get(country_code, PHONE_RULES.get(DEFAULT_COUNTRY))
        if rule:
            national_number_len = len(str(pn.national_number))
            if not (rule['min'] <= national_number_len <= rule['max']):
                raise ValueError(f"الرقم يجب أن يكون {rule['min']} خانات.")
        if not phonenumbers.is_valid_number(pn):
            raise ValueError("رقم الهاتف غير صالح.")
        return phonenumbers.format_number(pn, phonenumbers.PhoneNumberFormat.E164)
    except Exception as e:
        raise ValueError(f"صيغة رقم الهاتف غير صحيحة: {e}")

def generate_otp_code(length=6):
    return ''.join(str(secrets.randbelow(10)) for _ in range(length))

def get_tokens_for_customer(user):
    refresh = RefreshToken()
    refresh['user_id'] = user.id
    refresh['user_type'] = 'customer'

    access = refresh.access_token
    access['user_id'] = user.id
    access['user_type'] = 'customer'

    refresh.set_exp(lifetime=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'])
    access.set_exp(lifetime=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'])

    return {
        'refresh': str(refresh),
        'access': str(access),
    }

def create_and_send_phone_otp(user, otp_type):
    return OTPService.send_otp(user, otp_type)

def create_and_send_email_otp(user, otp_type):
    now = timezone.now()
    one_day_ago = now - timedelta(hours=24)

    recent_otps = OTP.objects.filter(
        user=user, type=otp_type, created_at__gte=one_day_ago
    ).order_by('-created_at')

    count = recent_otps.count()

    if count >= 5:
        raise Throttled(detail=_("لقد تجاوزت الحد المسموح (5 مرات). يرجى المحاولة غداً."), wait=86400)

    if count > 0:
        last_otp = recent_otps.first()
        time_passed = (now - last_otp.created_at).total_seconds()

        if count == 1:
            wait_time = 120
        elif count == 2:
            wait_time = 180
        else:
            wait_time = 600

        if time_passed < wait_time:
            remaining = int(wait_time - time_passed)
            minutes = remaining // 60
            seconds = remaining % 60
            if minutes > 0:
                time_str = f"{minutes} دقيقة و {seconds} ثانية"
            else:
                time_str = f"{seconds} ثانية"
            raise Throttled(detail=f"يرجى الانتظار {time_str} لإرسال الإيميل.", wait=remaining)

    OTP.objects.filter(user=user, type=otp_type, is_used=False).delete()

    code = generate_otp_code()
    expires_at = now + timedelta(minutes=5)
    OTP.objects.create(
        user=user,
        type=otp_type,
        code=code,
        expires_at=expires_at
    )

    if not user.email:
        raise ValueError("User has no email address")

    subject = "رمز التحقق الخاص بك من متجر لَحِم"
    name = user.full_name or 'عميلنا العزيز'

    try:
        html_content = render_to_string('emails/otp_email.html', {
            'name': name,
            'code': code
        })
    except Exception:
        html_content = f"""
        <div dir='rtl' style='direction: rtl; text-align: right; font-family: Arial, sans-serif;'>
            <p></p>
            <p>    :</p>
            <div style='text-align: center; margin: 20px 0;'>
                <strong style='font-size: 24px; direction: ltr; display: inline-block; letter-spacing: 5px; color: #198754;'>{code}</strong>
            </div>
        </div>
        """

    msg = EmailMultiAlternatives(
        subject=subject,
        body=f"رمز التحقق الخاص بك هو: {code}",
        from_email="متجر لَحِم <noreply@lahmfarm.com>",
        to=[user.email]
    )
    msg.attach_alternative(html_content, "text/html")

    try:
        msg.send()
        MessageLog.objects.create(recipient=user.email, content=f"كود التحقق: {code}", message_type='EMAIL', status='sent')
    except Exception as e:
        MessageLog.objects.create(recipient=user.email, content=f"كود التحقق: {code}", message_type='EMAIL', status='failed')
        print(f"SMTP Error ignored for development. OTP is: {code}")

    return True

def create_and_send_password_reset_otp(user, via_email=False):
    if via_email:
        return create_and_send_email_otp(user, OTP.OTPType.PASSWORD_RESET)
    return create_and_send_phone_otp(user, OTP.OTPType.PASSWORD_RESET)

