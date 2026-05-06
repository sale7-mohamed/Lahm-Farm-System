# management/signals.py
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from webpush import send_user_notification

from .models import Payroll, Employee, EmployeeStatusLog, ChatMessage
from accounting.models import Account, JournalEntry, TransactionLine

def get_account(account_number):
    try:
        return Account.objects.get(account_number=account_number)
    except Account.DoesNotExist:
        print(f"CRITICAL ERROR: Account with number {account_number} not found.")
        return None

@receiver(pre_save, sender=Employee)
def update_last_password_change(sender, instance, **kwargs):
    if not instance.pk and not instance.last_password_change:
        instance.last_password_change = timezone.now()

@receiver(post_save, sender=Employee)
def log_employee_status_change(sender, instance, created, **kwargs):
    if created:
        EmployeeStatusLog.objects.create(employee=instance, status='hired')
    else:
        update_fields = kwargs.get('update_fields') or set()
        if 'is_active' in update_fields:
            if instance.is_active:
                EmployeeStatusLog.objects.create(employee=instance, status='activated')
            else:
                EmployeeStatusLog.objects.create(
                    employee=instance,
                    status='deactivated',
                    reason=instance.deactivation_reason
                )

@receiver(post_save, sender=Payroll)
def record_salary_payment_entry(sender, instance, created, **kwargs):
    if not kwargs.get('update_fields') or 'is_paid' not in kwargs['update_fields']:
        return

    content_type = ContentType.objects.get_for_model(instance)

    with transaction.atomic():
        if instance.is_paid:
            if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).exists():
                return

            salaries_expense_acc = get_account('6000')
            cash_acc = get_account('1010')

            if not salaries_expense_acc or not cash_acc:
                return

            je = JournalEntry.objects.create(
                date=instance.paid_date,
                description=f"Salary payment for {instance.employee.full_name} for {instance.month}/{instance.year}",
                created_by_employee=instance.employee,
                content_type=content_type,
                object_id=instance.id
            )
            TransactionLine.objects.create(
                journal_entry=je,
                account=salaries_expense_acc,
                amount=instance.net_salary,
                entry_type='DEBIT'
            )
            TransactionLine.objects.create(
                journal_entry=je,
                account=cash_acc,
                amount=instance.net_salary,
                entry_type='CREDIT'
            )
        else:
            JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).delete()

@receiver(post_save, sender=ChatMessage)
def send_chat_notification(sender, instance, created, **kwargs):
    if not created:
        return

    channel_layer = get_channel_layer()
    room = instance.room
    author = instance.author

    for participant in room.participants.all():
        if participant.id == author.id:
            continue

        group_name = f'employee_notifications_{participant.id}'

        # WebSocket notification
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'new_chat_message',
                'content': {
                    'room_id': room.id,
                    'room_name': room.name or f"Chat with {author.full_name}",
                    'author_name': author.full_name,
                    'message_preview': instance.content[:50]
                }
            }
        )

        # Web Push notification
        try:
            payload = {
                "head": f"رسالة جديدة من {author.full_name}",
                "body": instance.content[:50] if instance.content else "أرسل لك مرفقاً 📁",
                "url": "/chat"
            }
            send_user_notification(user=participant, payload=payload, ttl=1000)
        except Exception as e:
            print(f"WebPush Chat Error: {e}")
