from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status

class UserRegistrationAPITest(APITestCase):
    def test_register_user(self):
        url = reverse('accounts:register')
        data = {
            "phone": "+201234567890",
            "password": "testpass123",
            "full_name": "Saleh",
            "address": "Cairo, Egypt"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

