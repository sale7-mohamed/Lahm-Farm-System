import secrets
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from accounts.models import OTP
from rest_framework.exceptions import Throttled

try:
    from messaging.services import MessagingService
except ImportError:
    MessagingService = None

class OTPService:

    @staticmethod
    def generate_code(length=6):
        return ''.join(str(secrets.randbelow(10)) for _ in range(length))

    @staticmethod
    def send_otp(user, otp_type):
        now = timezone.now()
        one_day_ago = now - timedelta(hours=24)

        recent_otps = OTP.objects.filter(
            user=user,
            type=otp_type,
            created_at__gte=one_day_ago
        ).order_by('-created_at')

        count = recent_otps.count()

        if count >= 5:
            raise Throttled(detail=_("لقد تجاوزت الحد المسموح (5 مرات) لليوم. يرجى المحاولة بعد 24 ساعة."), wait=86400)

        if count > 0:
            last_otp = recent_otps.first()
            time_passed = (now - last_otp.created_at).total_seconds()

            if count == 1:
                wait_time = 120
            elif count == 2:
                wait_time = 180    # 3 
            else:
                wait_time = 600    # 10 

            if time_passed < wait_time:
                remaining = int(wait_time - time_passed)
                minutes = remaining // 60
                seconds = remaining % 60
                if minutes > 0:
                    time_str = f"{minutes} دقيقة و {seconds} ثانية"
                else:
                    time_str = f"{seconds} ثانية"
                raise Throttled(detail=_("يرجى الانتظار %(time_str)s قبل طلب كود جديد.") % {'time_str': time_str}, wait=remaining)

        OTP.objects.filter(user=user, type=otp_type, is_used=False).delete()

        expiry_minutes = getattr(settings, 'OTP_EXPIRY_MINUTES', 5)
        code = OTPService.generate_code()
        otp_instance = OTP.objects.create(
            user=user,
            type=otp_type,
            code=code,
            expires_at=now + timedelta(minutes=expiry_minutes)
        )

        target = user.email if 'EMAIL' in otp_type and user.email else user.phone
        if not target:
            raise ValueError(_("لا يوجد رقم هاتف أو بريد إلكتروني لإرسال الكود."))

        if MessagingService:
            MessagingService.send_template_message(
                phone=target,
                template_key='OTP',
                context={'code': code, 'name': user.full_name},
                msg_type='OTP'
            )
        else:
            print(f"\n[DEV OTP] To: {target} | Code: {code}\n")

        return otp_instance

    @staticmethod
    def verify_otp(user, code, otp_type):
        try:
            otp = OTP.objects.filter(user=user, type=otp_type, is_used=False).latest('created_at')
        except OTP.DoesNotExist:
            return False, _("كود التحقق غير صحيح أو منتهي الصلاحية.")

        if not otp.is_valid() or not secrets.compare_digest(otp.code, code):
            return False, _("كود التحقق غير صحيح أو منتهي الصلاحية.")

        otp.is_used = True
        otp.save()
        return True, _("تم التحقق بنجاح.")

