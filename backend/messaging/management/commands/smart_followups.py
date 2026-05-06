from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from accounts.models import User as CustomerUser
from messaging.services import MessagingService
from messaging.models import MessageLog

class Command(BaseCommand):
    help = 'يرسل رسائل متابعة ترحيبية أو تذكير بالتفعيل عبر SMS/واتساب'

    def handle(self, *args, **options):
        now = timezone.localtime()

        # 1.    :     10   9 
        if not (10 <= now.hour <= 21):
            self.stdout.write("خارج أوقات العمل المسموحة للإرسال (من 10 ص إلى 9 م). سيتم التأجيل.")
            return

        #   :       24  
        two_hours_ago = now - timedelta(hours=2)
        twenty_four_hours_ago = now - timedelta(hours=24)

        # ========================================================
        #  :    ( )
        # ========================================================
        unverified_users = CustomerUser.objects.filter(
            is_staff=False,
            is_phone_verified=False,
            date_joined__lte=two_hours_ago,
            date_joined__gte=twenty_four_hours_ago
        )

        for user in unverified_users:
            already_sent = MessageLog.objects.filter(
                recipient__icontains=user.phone[-10:],
                message_type='AUTOMATED',
                content__icontains='بتواجه مشكلة في تفعيل حسابك'
            ).exists()

            if not already_sent:
                first_name = user.full_name.split()[0] if user.full_name else 'يا غالي'
                msg = f"أهلاً بيك في متجر لَحِم \nلاحظنا إنك سجلت يا {first_name} بس لسه مفعلتش حسابك! لو بتواجه مشكلة في تفعيل حسابك إحنا معاك خطوة بخطوة، كلمنا واتساب على:\nhttps://wa.me/201037029909"

                MessagingService.send_message(user.phone, msg, msg_type='AUTOMATED')
                self.stdout.write(self.style.SUCCESS(f"تم إرسال تذكير التفعيل إلى {user.phone}"))

        # ========================================================
        #  :       ( )
        # ========================================================
        verified_no_order_users = CustomerUser.objects.filter(
            is_staff=False,
            is_phone_verified=True,
            date_joined__lte=two_hours_ago,
            date_joined__gte=twenty_four_hours_ago,
            orders__isnull=True
        )

        for user in verified_no_order_users:
            already_sent = MessageLog.objects.filter(
                recipient__icontains=user.phone[-10:],
                message_type='AUTOMATED',
                content__icontains='نورتنا في متجر لَحِم'
            ).exists()

            if not already_sent:
                first_name = user.full_name.split()[0] if user.full_name else 'يا غالي'
                msg = f"نورتنا في متجر لَحِم يا {first_name} \nلو بتواجه صعوبة في اختيار ذبيحتك، أو حابب إحنا اللي نعملك الأوردر عشان نسهل عليك، تواصل معانا واتساب واحنا تحت أمرك:\nhttps://wa.me/201037029909"

                MessagingService.send_message(user.phone, msg, msg_type='AUTOMATED')
                self.stdout.write(self.style.SUCCESS(f"تم إرسال رسالة الترحيب إلى {user.phone}"))

        self.stdout.write("انتهت عملية المتابعة الذكية بنجاح.")
