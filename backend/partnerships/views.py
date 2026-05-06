# partnerships/views.py
from rest_framework import viewsets, generics, permissions
from .models import PartnershipApplication
from .serializers import PartnershipApplicationSerializer, PartnershipManagementSerializer
from management.permissions import IsManagementUser

class PublicPartnershipCreateView(generics.CreateAPIView):
    queryset = PartnershipApplication.objects.all()
    serializer_class = PartnershipApplicationSerializer
    permission_classes = [permissions.AllowAny]

class ManagementPartnershipViewSet(viewsets.ModelViewSet):
    queryset = PartnershipApplication.objects.all()
    serializer_class = PartnershipManagementSerializer
    permission_classes = [IsManagementUser]
    filterset_fields = ['status', 'application_type']
