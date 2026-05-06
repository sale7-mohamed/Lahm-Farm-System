import threading
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from webpush import send_user_notification

from .models import Notification
from accounts.models import User as CustomerUser
from management.models import Employee
from management.permissions_engine import get_effective_access

def send_notification(user, title, message, category='general'):
    if not isinstance(user, CustomerUser) or not user.is_active:
        return None

    notif = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        category=category
    )

    channel_layer = get_channel_layer()
    group_name = f"customer_notifications_{user.id}"

    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "send_notification",
                "content": {
                    "id": notif.id,
                    "title": notif.title,
                    "message": notif.message,
                    "category": notif.category,
                    "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M:%S")
                }
            }
        )
    except Exception:
        pass

    try:
        payload = {
            "head": title,
            "body": message,
            "url": "/notifications"
        }
        send_user_notification(user=user, payload=payload, ttl=1000)
    except Exception:
        pass

    return notif

def _send_global_thread(title, message, category):
    users = CustomerUser.objects.filter(is_active=True).distinct()
    if not users.exists():
        return

    notifications =[
        Notification(user=u, title=title, message=message, category=category)
        for u in users
    ]
    Notification.objects.bulk_create(notifications)

    channel_layer = get_channel_layer()
    now_str = timezone.now().strftime("%Y-%m-%d %H:%M:%S")

    payload = {
        "head": title,
        "body": message,
        "url": "/notifications"
    }

    for user in users:
        try:
            async_to_sync(channel_layer.group_send)(
                f"customer_notifications_{user.id}",
                {
                    "type": "send_notification",
                    "content": {
                        "id": 0,
                        "title": title,
                        "message": message,
                        "category": category,
                        "created_at": now_str
                    }
                }
            )
        except Exception:
            pass

        try:
            send_user_notification(user=user, payload=payload, ttl=1000)
        except Exception:
            pass

def send_global_notification(title, message, category='general'):
    thread = threading.Thread(target=_send_global_thread, args=(title, message, category))
    thread.daemon = True
    thread.start()

def send_admin_notification(title, message, category='general'):
    admins = Employee.objects.filter(is_staff=True, is_active=True)
    if not admins.exists():
        return

    channel_layer = get_channel_layer()
    now_str = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
    payload = { "head": title, "body": message, "url": "/dashboard" }

    #   (Module)       
    required_module = None
    if category in ['order', 'reservation', 'business_request']:
        required_module = 'orders'
    elif category == 'livestock':
        required_module = 'livestock'

    for admin in admins:

        if required_module and not admin.is_superuser:
            access = get_effective_access(admin, required_module)
            if not access['actions'].get('view'):
                continue

        group_name = f"employee_notifications_{admin.id}"

        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_notification",
                    "content": {
                        "id": 0,
                        "title": title,
                        "message": message,
                        "category": category,
                        "created_at": now_str
                    }
                }
            )
        except Exception:
            pass

        try:
            send_user_notification(user=admin, payload=payload, ttl=1000)
        except Exception:
            pass
