from rest_framework import serializers
from .models import Payment

class PaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = (
            'status',
            'transaction_id',
            'created_at',
            'updated_at',
            'user',
            'payment_type',
            'recorded_by',
            'amount',
            'order',
        )

