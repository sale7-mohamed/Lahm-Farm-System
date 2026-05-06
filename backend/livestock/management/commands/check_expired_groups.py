from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from livestock.models import AdahiGroup
from orders.models import OrderItem
from notifications.utils import send_notification

class Command(BaseCommand):
    help = 'تحويل المجموعات الخاصة المنتهية (والمؤكدة مالياً) إلى مسبح عام'

    def handle(self, *args, **options):
        now = timezone.now()
        expired_groups = AdahiGroup.objects.filter(
            expires_at__lt=now,
            is_active=True
        ).select_related('animal', 'created_by')

        count = 0
        processed_groups = []
        failed_groups = []

        for group in expired_groups:
            animal = group.animal

            try:
                with transaction.atomic():
                    sold_items_qs = OrderItem.objects.filter(
                        animal=animal,
                        order__status__in=['confirmed', 'processing', 'ready_for_shipment',
                                         'shipped', 'delivered', 'completed']
                    ).select_related('order__user')

                    sold_shares = sold_items_qs.aggregate(total=Sum('share_quantity'))['total'] or 0

                    if sold_shares < animal.max_shares:
                        remaining_shares = animal.max_shares - sold_shares

                        animal.lock_type = 'adahi_pool'
                        animal.is_adahi = True
                        animal.is_adahi_pool = True
                        animal.is_shareable = False
                        animal.shares_section_max_shares = 0
                        animal.save(update_fields=[
                            'lock_type', 'is_adahi', 'is_adahi_pool',
                            'is_shareable', 'shares_section_max_shares'
                        ])

                        self.stdout.write(
                            f'تم تحويل المجموعة {group.code} إلى مسبح عام '
                            f'(المباع: {sold_shares}, المتبقي: {remaining_shares})'
                        )

                        users_to_notify = set()
                        if group.created_by:
                            users_to_notify.add(group.created_by)
                        for item in sold_items_qs:
                            if item.order and item.order.user:
                                users_to_notify.add(item.order.user)

                        for user in users_to_notify:
                            try:
                                send_notification(
                                    user=user,
                                    title="تحديث حالة الأضحية",
                                    message=(
                                        f"انتهى وقت المجموعة الخاصة {group.code}. "
                                        f"لضمان اكتمال الأضحية وتنفيذ الذبح، تم تحويل الأسهم المتبقية "
                                        f"({remaining_shares}) للمشاركة العامة. سهمك محفوظ ومؤكد."
                                    ),
                                    category="livestock"
                                )
                            except Exception as e:
                                self.stdout.write(
                                    self.style.WARNING(
                                        f'فشل إرسال إشعار للمستخدم {user.id}: {str(e)}'
                                    )
                                )

                        processed_groups.append({
                            'code': group.code,
                            'status': 'converted',
                            'sold_shares': sold_shares,
                            'remaining_shares': remaining_shares
                        })
                    else:
                        self.stdout.write(
                            f'المجموعة {group.code} مكتملة بالفعل ({sold_shares} سهم)'
                        )
                        processed_groups.append({
                            'code': group.code,
                            'status': 'completed',
                            'sold_shares': sold_shares
                        })

                    group.is_active = False
                    group.save(update_fields=['is_active'])
                    count += 1

            except Exception as e:
                error_msg = f'خطأ في معالجة المجموعة {group.code}: {str(e)}'
                self.stdout.write(self.style.ERROR(error_msg))
                failed_groups.append({
                    'code': group.code,
                    'error': str(e)
                })
                continue

        if count > 0:
            success_msg = f'تمت معالجة {count} مجموعة منتهية '
            if processed_groups:
                success_msg += f'(تم تحويل {len([g for g in processed_groups if g["status"] == "converted"])})'
            self.stdout.write(self.style.SUCCESS(success_msg))

        if failed_groups:
            self.stdout.write(self.style.WARNING(f'فشل معالجة {len(failed_groups)} مجموعة'))
            for failed in failed_groups:
                self.stdout.write(f"  - {failed['code']}: {failed['error']}")
