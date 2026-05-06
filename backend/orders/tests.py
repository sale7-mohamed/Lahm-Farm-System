from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from datetime import date
from livestock.models import Category, Animal
from orders.models import Order, OrderItem

User = get_user_model()

class OrdersAPITestCase(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            phone='01234567890',  #   user model    phone 
            password='testpassword123',
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name_ar="ابقار")
        self.animal = Animal.objects.create(
            category=self.category,
            sex='male',
            age_months=12,
            weight_kg=200,
            weight_date=date.today(),
            price_egp=5000,
            status='available',
        )

        # URL   
        self.orders_url = reverse('order-list')  #    router ( basename  'order')

    def test_create_order(self):
        data = {
            "user_id": self.user.id,
            "total_price": 10000.00,
            "items": [
                {
                    "animal_id": self.animal.id,
                    "quantity": 1,
                    "price_per_item": 5000.00
                },
                {
                    "animal_id": self.animal.id,
                    "quantity": 1,
                    "price_per_item": 5000.00
                }
            ]
        }

        response = self.client.post(self.orders_url, data, format='json')
        print(response.data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(OrderItem.objects.count(), 2)
        self.assertEqual(response.data['total_price'], '10000.00')

    def test_get_orders(self):
        order = Order.objects.create(user=self.user, total_price=5000)
        OrderItem.objects.create(order=order, animal=self.animal, quantity=1, price_per_item=5000)

        response = self.client.get(self.orders_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_update_order(self):
        order = Order.objects.create(user=self.user, total_price=5000)
        OrderItem.objects.create(order=order, animal=self.animal, quantity=1, price_per_item=5000)

        url = reverse('order-detail', kwargs={'pk': order.pk})
        data = {
            "total_price": 7000,
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(float(order.total_price), 7000)

    def test_delete_order(self):
        order = Order.objects.create(user=self.user, total_price=5000)
        OrderItem.objects.create(order=order, animal=self.animal, quantity=1, price_per_item=5000)

        url = reverse('order-detail', kwargs={'pk': order.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Order.objects.filter(pk=order.pk).exists())

