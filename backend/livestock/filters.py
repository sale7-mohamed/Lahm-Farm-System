# D:\pro\life\livestock\filters.py
import re
from django.db.models import Q
from django.db.models.functions import Replace
from django.db.models import Value
from django_filters import rest_framework as filters
from .models import Animal

class AnimalFilter(filters.FilterSet):
    price_min = filters.NumberFilter(field_name="price_egp", lookup_expr='gte')
    price_max = filters.NumberFilter(field_name="price_egp", lookup_expr='lte')

    weight_min = filters.NumberFilter(field_name="annotated_current_weight", lookup_expr='gte')
    weight_max = filters.NumberFilter(field_name="annotated_current_weight", lookup_expr='lte')

    age_min = filters.NumberFilter(field_name="age_months", lookup_expr='gte')
    age_max = filters.NumberFilter(field_name="age_months", lookup_expr='lte')

    sex = filters.CharFilter(field_name="sex", lookup_expr='iexact')
    status = filters.CharFilter(field_name="status", lookup_expr='iexact')
    breed = filters.CharFilter(field_name="breed", lookup_expr='icontains')

    category = filters.CharFilter(method="filter_category")
    search = filters.CharFilter(method="filter_search")
    has_discount = filters.BooleanFilter(method="filter_has_discount")
    suitable_for = filters.CharFilter(method="filter_suitable_for")

    class Meta:
        model = Animal
        fields = [
            'price_min', 'price_max',
            'weight_min', 'weight_max',
            'age_min', 'age_max',
            'sex', 'status', 'breed',
            'category', 'search',
            'has_discount', 'suitable_for',
        ]

    def filter_category(self, queryset, name, value: str):
        bits = [v.strip() for v in value.split(',') if v.strip()]
        if not bits:
            return queryset

        ids = [b for b in bits if b.isdigit()]
        slugs = [b for b in bits if not b.isdigit()]
        q_obj = Q()
        if ids:
            q_obj |= Q(category_id__in=ids)
        if slugs:
            q_obj |= Q(category__slug__in=slugs)

        return queryset.filter(q_obj) if q_obj else queryset

    def filter_search(self, queryset, name, value: str):
            if not value:
                return queryset

            value = value.strip().lower()
            q_obj = Q()

            synonyms = {
                'بقرة': ['بقر', 'عجول'], 'بقر': ['بقر', 'عجول'], 'عجل':['بقر', 'عجول'], 'جاموس': ['بقر', 'عجول'],
                'خروف': ['ضأن', 'خراف'], 'ضأن': ['ضأن', 'خراف'], 'خراف': ['ضأن', 'خراف'],
                'ماعز': ['ماعز'], 'جدي':['ماعز'],
                'جمل': ['إبل', 'جمال'], 'ابل':['إبل', 'جمال']
            }

            for key, mapped_cats in synonyms.items():
                if key in value:
                    for cat in mapped_cats:
                        q_obj |= Q(category__name_ar__icontains=cat)

            clean_value = value.replace(' ', '').replace('#', '')

            if 'clean_code' not in queryset.query.annotations:
                queryset = queryset.annotate(
                    clean_code=Replace(Replace('code', Value(' '), Value('')), Value('#'), Value(''))
                )

            search_words = value.split()
            breed_query = Q()
            for word in search_words:
                breed_query |= Q(breed__icontains=word)

            q_obj |= (
                Q(clean_code__icontains=clean_value) |
                breed_query |
                Q(description__icontains=value) |
                Q(category__name_ar__icontains=value)
            )

            return queryset.filter(q_obj)

    def filter_has_discount(self, queryset, name, value: bool):
        if value:
            return queryset.filter(discount_percent__gt=0, is_offer=True)
        return queryset

    def filter_suitable_for(self, queryset, name, value: str):
        value = value.strip().lower()
        mapping = {
            'udhiyah': 'is_suitable_udhiyah',
            'aqiqah': 'is_suitable_aqiqah',
            'feast': 'is_suitable_feast',
            'home': 'is_suitable_home',
        }
        field = mapping.get(value)
        if field:
            return queryset.filter(**{field: True})
        return queryset

