from decimal import Decimal

from django.db.models import Sum

from orders.models import OrderItem
from .models import FeedingLog, HealthLog, WeightLog

def calculate_fcr_for_animal(animal, start_date, end_date):
    """
    Calculates Feed Conversion Ratio (FCR) for a specific animal over a period.
    FCR = Total Feed Consumed (kg) / Total Weight Gained (kg)
    """
    initial_weight_log = (
        WeightLog.objects.filter(animal=animal, date__lte=start_date)
        .order_by("-date")
        .first()
    )
    final_weight_log = (
        WeightLog.objects.filter(animal=animal, date__lte=end_date)
        .order_by("-date")
        .first()
    )

    if not initial_weight_log or not final_weight_log or initial_weight_log.date >= final_weight_log.date:
        return {"error": "لا توجد بيانات وزن كافية في هذه الفترة لحساب المعامل."}

    initial_weight = initial_weight_log.weight_kg
    final_weight = final_weight_log.weight_kg
    weight_gained = final_weight - initial_weight

    if weight_gained <= 0:
        return {
            "initial_weight": initial_weight,
            "final_weight": final_weight,
            "weight_gained": weight_gained,
            "total_feed_consumed": 0,
            "fcr": "N/A (لم تحدث زيادة في الوزن)",
        }

    total_feed = (
        FeedingLog.objects.filter(
            animal=animal,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date,
        ).aggregate(total=Sum("quantity_kg"))["total"]
        or Decimal("0.0")
    )

    if total_feed <= 0:
        return {"error": "لم يتم تسجيل أي تغذية لهذا الحيوان في الفترة المحددة."}

    fcr = total_feed / weight_gained

    return {
        "animal_code": animal.code,
        "start_date": start_date,
        "end_date": end_date,
        "initial_weight": initial_weight,
        "final_weight": final_weight,
        "weight_gained": weight_gained,
        "total_feed_consumed": total_feed,
        "fcr": round(fcr, 2),
    }

def calculate_animal_profitability(animal):
    """
    Calculates the profitability of a single animal.
    Profit = Sale Price - (Purchase Cost + Total Feed Cost + Total Health Cost)
    """
    if animal.status != "sold":
        return {"error": "لا يمكن حساب الربحية إلا لحيوان تم بيعه."}

    sold_items = OrderItem.objects.filter(
        animal=animal,
        order__status__in=["completed", "delivered", "shipped", "ready_for_shipment"],
    )

    if not sold_items.exists():
        return {"error": "لم يتم العثور على سجل بيع مكتمل لهذا الحيوان في الطلبات."}

    sale_price = sold_items.aggregate(total=Sum("price_per_item"))["total"] or Decimal("0.00")

    purchase_cost = animal.purchase_price

    ASSUMED_FEED_COST_PER_KG = Decimal("15.0")
    total_feed_quantity = (
        FeedingLog.objects.filter(animal=animal).aggregate(total_kg=Sum("quantity_kg"))["total_kg"]
        or Decimal("0.0")
    )
    total_feed_cost = total_feed_quantity * ASSUMED_FEED_COST_PER_KG

    total_health_cost = (
        HealthLog.objects.filter(animal=animal).aggregate(total=Sum("cost"))["total"]
        or Decimal("0.0")
    )

    total_cost = purchase_cost + total_feed_cost + total_health_cost
    net_profit = sale_price - total_cost

    return {
        "animal_code": animal.code,
        "sale_price": sale_price,
        "total_cost": total_cost,
        "net_profit": net_profit,
        "breakdown": {
            "purchase_cost": purchase_cost,
            "total_feed_cost": total_feed_cost,
            "total_health_cost": total_health_cost,
        },
    }
