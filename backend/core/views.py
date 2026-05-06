from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Country, Governorate, GlobalDiscountSettings, OperationSettings
from .serializers import CountrySerializer, GovernorateSerializer

class CountryListAPIView(generics.ListAPIView):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]
    pagination_class = None

class GovernorateListAPIView(generics.ListAPIView):
    serializer_class = GovernorateSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        queryset = Governorate.objects.all().order_by('name_ar')
        country_code = self.request.query_params.get("country")
        if country_code:
            return queryset.filter(country__code__iexact=country_code)
        return queryset

class PublicGlobalDiscountView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        settings = GlobalDiscountSettings.load()
        data = {
            'is_active': settings.is_active,
            'percentage': settings.percentage,
            'applies_to_services': settings.applies_to_services,
            'ticker_message': settings.ticker_message,
            'start_date': settings.start_date,
            'end_date': settings.end_date
        }
        return Response(data)

class PublicOperationSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        settings = OperationSettings.load()

        from livestock.models import DeliveryArea
        active_governorates = list(DeliveryArea.objects.filter(
            is_active=True
        ).values_list('governorate__name_ar', flat=True))

        data = {
            'eid_adha_date': settings.eid_adha_date,
            'enable_eid_celebration': settings.enable_eid_celebration,
            'show_eid_timer': settings.show_eid_timer,
            'delivery_active': settings.enable_delivery_service,
            'pickup_active': settings.enable_farm_pickup,
            'active_governorates': active_governorates,
            'enable_ramadan_celebration': settings.enable_ramadan_celebration,
            'ramadan_start_date': settings.ramadan_start_date,
            'enable_eid_fitr_celebration': settings.enable_eid_fitr_celebration,
            'eid_fitr_start_date': settings.eid_fitr_start_date,
            'is_adahi_season_active': settings.is_adahi_season_active,
            'enable_internal_slaughter': settings.enable_internal_slaughter,
            'enable_fridge_manager': settings.enable_fridge_manager,
            'enable_eid_receive_button': settings.enable_eid_receive_button,
            'days_to_eid': settings.days_to_eid,
            'days_to_eid_fitr': settings.days_to_eid_fitr,
            'days_in_ramadan': settings.days_in_ramadan,
            'enable_general_shares': settings.enable_general_shares,
            'enable_slaughter_video_request': settings.enable_slaughter_video_request,
            'enable_adahi_full': settings.enable_adahi_full,
            'enable_adahi_pool': settings.enable_adahi_pool,
            'enable_adahi_group': settings.enable_adahi_group,
            'pricing_model': settings.pricing_model,
        }
        return Response(data)

