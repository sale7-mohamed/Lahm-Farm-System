from django.core.management.base import BaseCommand
from messaging.models import MessageTemplate

class Command(BaseCommand):
    help = 'Initializes default message templates'

    def handle(self, *args, **options):
        defaults = [
            ('OTP', 'رمز التحقق الخاص بك هو: {code}. صالح لمدة 5 دقائق.'),
            ('ORDER_CONFIRMED', 'مرحباً {name}، تم تأكيد طلبك رقم #{id}   {total} .'),
            ('ORDER_SHIPPED', 'مرحباً {name}، طلبك رقم #{id}     .'),
            ('ORDER_DELIVERED', 'تم تسليم طلبك رقم #{id}.   .'),
        ]

        for key, content in defaults:
            obj, created = MessageTemplate.objects.get_or_create(
                key=key,
                defaults={'content': content, 'is_active': True}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created template: {key}'))
            else:
                self.stdout.write(f'Template exists: {key}')