from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from datetime import date
from livestock.models import Category, Animal
from cart.models import Cart, CartItem

User = get_user_model()
API_CART_LIST_URL = "/api/cart/"
API_CART_ITEMS_LIST_URL = "/api/cart/items/"

class CartAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            phone="+201234567890",
            password="testpass",
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name_ar="ابقار")
        self.animal = Animal.objects.create(
            category=self.category,
            sex="male",
            age_months=10,
            weight_kg=200,
            weight_date=date.today(),
            price_egp=5000,
            status="available",
        )
        self.cart, _ = Cart.objects.get_or_create(user=self.user)

    def _detail_url(self, pk: int) -> str:
        #     cart items
        return f"/api/cart/{pk}/"

    def _add_item(self, qty=1):
        return CartItem.objects.create(cart=self.cart, animal=self.animal, quantity=qty)

    def test_add_item_to_cart(self):
        data = {
            "animal_id": self.animal.id,
            "quantity": 2
        }
        response = self.client.post(API_CART_LIST_URL, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(CartItem.objects.count(), 1)
        item = CartItem.objects.first()
        self.assertEqual(item.quantity, 2)

    def test_get_cart_items(self):
        CartItem.objects.create(cart=self.cart, animal=self.animal, quantity=3)
        response = self.client.get(API_CART_LIST_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_update_cart_item_quantity(self):
        item = CartItem.objects.create(cart=self.cart, animal=self.animal, quantity=1)
        url = f"{API_CART_LIST_URL}{item.pk}/"
        response = self.client.patch(url, {"quantity": 5}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 5)

    def test_delete_cart_item(self):
        item = CartItem.objects.create(cart=self.cart, animal=self.animal, quantity=1)
        url = f"{API_CART_LIST_URL}{item.pk}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CartItem.objects.filter(pk=item.pk).exists())
