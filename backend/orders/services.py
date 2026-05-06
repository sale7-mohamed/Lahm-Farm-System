from decimal import Decimal
from django.utils import timezone
from core.models import GlobalDiscountSettings
from livestock.models import ServicePriceSetting, AnimalListing
from accounts.models import User as CustomerUser
import logging

logger = logging.getLogger(__name__)

class PricingService:
    """
    Service for calculating prices, discounts, and deposits for animal orders.
    """

    SERVICE_SLAUGHTER = 'ذبح'
    SERVICE_CUTTING = 'تقطيع'
    SERVICE_PACKAGING = 'تعبئة'

    SECTION_FULL_SALE = 'full_sale'
    SECTION_ADAHI_POOL = 'adahi_pool'
    SECTION_ADAHI_GROUP = 'adahi_group'
    SECTION_ADAHI_FULL = 'adahi_full'
    SECTION_SHARES = 'shares'

    @classmethod
    def _get_service_prices(cls):
        """Retrieve active service prices from database or return defaults."""
        try:
            prices = ServicePriceSetting.objects.filter(is_active=True)
            return {s.name: s.price for s in prices}
        except Exception as e:
            logger.error(f"Error fetching service prices: {e}")
            return {
                cls.SERVICE_SLAUGHTER: Decimal('50.00'),
                cls.SERVICE_CUTTING: Decimal('30.00'),
                cls.SERVICE_PACKAGING: Decimal('20.00'),
            }

    @classmethod
    def _get_listing_price(cls, animal, pipeline, section):
        """
        Return (price_per_share, total_shares, listing_used) if an active listing exists.
        Otherwise return (None, None, False).
        """
        try:
            listing = AnimalListing.objects.get(
                animal=animal,
                pipeline=pipeline,
                section=section,
                is_active=True
            )
            return listing.price_per_share, listing.total_shares if hasattr(listing, 'total_shares') else None, True
        except AnimalListing.DoesNotExist:
            return None, None, False

    @classmethod
    def _calculate_base_price(cls, animal, share_qty, pipeline, section, services):
        """
        Determine base price (for the requested quantity) and share price.
        Returns (base_price, share_price, listing_used).
        """
        listing_price, listing_total_shares, listing_used = cls._get_listing_price(animal, pipeline, section)

        if listing_used:
            share_price = listing_price
            base_price = share_price * Decimal(share_qty)
            return base_price, share_price, listing_used

        animal_full_price = Decimal(animal.price_egp or 0)
        if animal_full_price < 0:
            animal_full_price = Decimal('0.00')

        if section == cls.SECTION_ADAHI_GROUP:
            total_shares = 7
        elif share_qty > 1:
            if pipeline == 'S' and section == cls.SECTION_ADAHI_POOL:
                total_shares = 7
            elif pipeline == 'G':
                total_shares = animal.category.default_max_shares or 5
            else:
                total_shares = 1
        else:
            total_shares = 1

        share_price = animal_full_price / Decimal(total_shares)
        base_price = share_price * Decimal(share_qty)
        return base_price, share_price, listing_used

    @classmethod
    def _calculate_service_cost(cls, services, animal):
        cost = Decimal('0.00')
        cat = animal.category

        if (services.get('slaughter') or services.get('ذبح')) and getattr(cat, 'enable_slaughter', True):
            cost += Decimal(str(getattr(cat, 'slaughter_price', 0)))

        if (services.get('cutting') or services.get('تقطيع')) and getattr(cat, 'enable_cutting', True):
            cost += Decimal(str(getattr(cat, 'cutting_price', 0)))

        if (services.get('packaging') or services.get('تعبئة')) and getattr(cat, 'enable_packaging', True):
            cost += Decimal(str(getattr(cat, 'packaging_price', 0)))

        return cost

    @classmethod
    def _get_best_discount(cls, animal, user, base_price, listing_used, service_cost):
        """
        Returns (best_fixed, best_percent, applies_to_services, source).
        Fixed discount (voucher) is never returned as a per‑item discount;
        it is applied once at cart/order level.
        """
        if not user or not isinstance(user, CustomerUser):
            return Decimal('0.00'), Decimal('0.00'), False, 'none'

        now = timezone.now()
        best_percent = Decimal('0.00')
        best_fixed = Decimal('0.00')
        applies_to_services = False
        source = 'none'

        # Animal offer discount (only when no listing used)
        if not listing_used and animal.is_offer:
            animal_discount = Decimal(animal.discount_percent or 0)
            if animal_discount > best_percent:
                best_percent = animal_discount
                applies_to_services = False
                source = 'animal'

        # User special discount (percentage only – fixed is handled at cart level)
        if user.is_discount_active:
            date_valid = (
                (not user.discount_start_date or now >= user.discount_start_date) and
                (not user.discount_end_date or now <= user.discount_end_date)
            )
            limit_valid = (
                user.discount_max_animals == 0 or
                user.discount_used_animals < user.discount_max_animals
            )
            if date_valid and limit_valid:
                if getattr(user, 'special_discount_type', 'percentage') == 'fixed':
                    # Fixed voucher – skip per‑item discount but still block global discount
                    source = 'user_special'
                    applies_to_services = user.discount_applies_to_services
                else:
                    user_percent = Decimal(user.special_discount_percentage or 0)
                    if user_percent > best_percent:
                        best_percent = user_percent
                        best_fixed = Decimal('0.00')
                        applies_to_services = user.discount_applies_to_services
                        source = 'user_special'

        # Global discount (only if no user special discount active)
        if user.allow_global_discount and source != 'user_special':
            try:
                global_settings = GlobalDiscountSettings.load()
                if global_settings.is_active and global_settings.percentage > 0:
                    date_valid = (
                        (not global_settings.start_date or now >= global_settings.start_date) and
                        (not global_settings.end_date or now <= global_settings.end_date)
                    )
                    limit_valid = (
                        global_settings.max_animals_per_user == 0 or
                        user.global_discount_used_animals < global_settings.max_animals_per_user
                    )
                    if date_valid and limit_valid:
                        global_percent = Decimal(global_settings.percentage)
                        if global_percent > best_percent:
                            best_percent = global_percent
                            best_fixed = Decimal('0.00')
                            applies_to_services = global_settings.applies_to_services
                            source = 'global'
            except Exception:
                pass

        return best_fixed, best_percent, applies_to_services, source

    @classmethod
    def _calculate_deposit(cls, animal, base_price, service_cost, final_total, share_qty, services):
        payment_type = services.get('payment_type', 'full')
        user_deposit = Decimal(str(services.get('user_entered_deposit_amount', '0.00')))
        cat = animal.category

        if payment_type == 'deposit' and user_deposit > Decimal('0.00'):
            return user_deposit

        if payment_type == 'deposit':
            fixed_deposit = Decimal(str(animal.deposit_egp or 0))
            if fixed_deposit > 0:
                if share_qty > 1:
                    total_shares = 7 if share_qty > 1 else 1
                    fixed_deposit = (fixed_deposit / Decimal(total_shares)) * Decimal(share_qty)
                return fixed_deposit + service_cost
            else:
                slaughter_requested = services.get('slaughter') or services.get('ذبح')
                if slaughter_requested and getattr(cat, 'enable_slaughter', True):
                    percentage = Decimal(str(getattr(cat, 'service_deposit_percentage', '0.50')))
                else:
                    percentage = Decimal(str(getattr(cat, 'min_deposit_percentage', '0.20')))
                return ((final_total - service_cost) * percentage) + service_cost

        return final_total

    @classmethod
    def calculate_item_price(cls, animal, share_qty=1, services=None, user=None, pipeline='M', section=None):
        if services is None:
            services = {}

        if section is None:
            if pipeline == 'M':
                section = cls.SECTION_FULL_SALE
            elif pipeline == 'S':
                context = services.get('_order_context', '')
                if context == 'adahi_pool':
                    section = cls.SECTION_ADAHI_POOL
                elif context == 'adahi_group':
                    section = cls.SECTION_ADAHI_GROUP
                else:
                    section = cls.SECTION_ADAHI_FULL
            elif pipeline == 'G':
                section = cls.SECTION_SHARES

        base_price, share_price, listing_used = cls._calculate_base_price(
            animal, share_qty, pipeline, section, services
        )

        service_cost = cls._calculate_service_cost(services, animal)

        discount_fixed, discount_percent, discount_on_services, discount_source = cls._get_best_discount(
            animal, user, base_price, listing_used, service_cost
        )

        discountable = base_price
        if discount_on_services:
            discountable += service_cost

        discount_amount = Decimal('0.00')
        if discount_fixed > 0:
            discount_amount = discount_fixed
        else:
            discount_amount = discountable * (discount_percent / Decimal('100'))

        final_price = (base_price + service_cost) - discount_amount

        base_price = max(base_price, Decimal('0.00'))
        service_cost = max(service_cost, Decimal('0.00'))
        discount_amount = max(discount_amount, Decimal('0.00'))
        final_price = max(final_price, Decimal('0.00'))

        deposit_amount = cls._calculate_deposit(
            animal, base_price, service_cost, final_price, share_qty, services
        )

        return {
            'animal_base_price': round(Decimal(animal.price_egp or 0), 2),
            'price_after_offer': round(Decimal(animal.price_after_discount or 0), 2),
            'share_price': round(share_price, 2),
            'listing_used': listing_used,
            'pipeline': pipeline,
            'section': section,
            'final_item_price': round(base_price, 2),
            'service_cost': round(service_cost, 2),
            'discount_percentage': round(discount_percent, 2),
            'discount_amount': round(discount_amount, 2),
            'discount_source': discount_source,
            'final_price': round(final_price, 2),
            'deposit_amount': round(deposit_amount, 2),
        }

    @classmethod
    def calculate_cart_totals(cls, cart, user=None, pipeline='M'):
        total = Decimal('0.00')
        items_details = []
        voucher_discount = Decimal('0.00')

        try:
            cart_items = cart.items.select_related('animal', 'animal__category').all()
            effective_user = user or cart.user

            for item in cart_items:
                saved_price = item.price_per_item or Decimal('0.00')
                item_pipeline = getattr(item, 'pipeline', pipeline)
                item_section = getattr(item, 'listing_section', None)
                item_services = item.selected_services if item.selected_services is not None else {}

                calc = cls.calculate_item_price(
                    animal=item.animal,
                    share_qty=item.share_quantity or 1,
                    services=item_services,
                    user=effective_user,
                    pipeline=item_pipeline,
                    section=item_section
                )

                item_total = calc['final_price']
                if item_total <= Decimal('0.00') and saved_price > Decimal('0.00'):
                    item_total = saved_price

                total += item_total
                items_details.append({
                    'item_id': item.id,
                    'calculation': calc
                })

            # Apply fixed amount voucher discount at cart level (once)
            if effective_user and effective_user.is_discount_active and getattr(effective_user, 'special_discount_type', 'percentage') == 'fixed':
                now = timezone.now()
                date_valid = (
                    (not effective_user.discount_start_date or now >= effective_user.discount_start_date) and
                    (not effective_user.discount_end_date or now <= effective_user.discount_end_date)
                )
                limit_valid = (
                    effective_user.discount_max_animals == 0 or
                    effective_user.discount_used_animals < effective_user.discount_max_animals
                )
                if date_valid and limit_valid:
                    voucher_discount = Decimal(effective_user.special_discount_amount or 0)
                    total = max(Decimal('0.00'), total - voucher_discount)

        except Exception as e:
            logger.error(f"Error calculating cart totals for cart {cart.id}: {e}")
            total = Decimal('0.00')
            voucher_discount = Decimal('0.00')
            for item in cart.items.all():
                total += (item.price_per_item or Decimal('0.00'))

        return total, items_details, voucher_discount
