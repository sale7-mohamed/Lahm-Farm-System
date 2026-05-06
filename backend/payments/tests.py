# payments/tests.py
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from datetime import date

from livestock.models import Category, Animal
from orders.models import Order, OrderItem
from payments.models import Payment

User = get_user_model()

class PaymentsAPITestCase(APITestCase):
    def setUp(self):
        # user
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass",
            phone="+201234567890",
        )
        self.client.force_authenticate(user=self.user)

        # minimal livestock obj -> order will reference item(s)
        self.cat = Category.objects.create(name_ar="ابقار")
        self.animal = Animal.objects.create(
            category=self.cat,
            sex="male",
            age_months=12,
            weight_kg=200,
            weight_date=date.today(),
            price_egp=5000,
            status="available",
        )

        # order
        self.order = Order.objects.create(user=self.user, total_price=1000)
        OrderItem.objects.create(
            order=self.order,
            animal=self.animal,
            quantity=1,
            price_per_item=1000,
        )

        # router basename = 'payments'
        self.payments_url = reverse("payments-list")

    def test_create_payment(self):
        data = {
            "order": self.order.id,
            "amount": 1000,
            "payment_method": "credit_card",
        }
        response = self.client.post(self.payments_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Payment.objects.count(), 1)

        p = Payment.objects.first()
        #  ID
        self.assertEqual(response.data["payment_id"], p.id)
        # amount 
        self.assertEqual(float(p.amount), float(data["amount"]))

    def test_get_payments(self):
        Payment.objects.create(
            order=self.order,
            user=self.user,
            amount=1000,
            payment_method="credit_card",
            status="pending",
        )
        response = self.client.get(self.payments_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_update_payment_status(self):
        payment = Payment.objects.create(
            order=self.order,
            user=self.user,
            amount=1000,
            payment_method="credit_card",
            status="pending",
        )
        url = reverse("payments-detail", kwargs={"pk": payment.id})
        data = {"status": "completed"}
        response = self.client.patch(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "completed")

    def test_delete_payment(self):
        payment = Payment.objects.create(
            order=self.order,
            user=self.user,
            amount=1000,
            payment_method="credit_card",
            status="pending",
        )
        url = reverse("payments-detail", kwargs={"pk": payment.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Payment.objects.filter(pk=payment.id).exists())

