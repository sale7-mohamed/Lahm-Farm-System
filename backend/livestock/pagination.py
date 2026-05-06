from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
import math

class CustomPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        page_size = self.get_page_size(self.request) or self.page.paginator.per_page
        total_items = self.page.paginator.count
        total_pages = math.ceil(total_items / page_size) if page_size else 1
        current_page = self.page.number

        return Response({
            'count': total_items,
            'total_pages': total_pages,
            'current_page': current_page,
            'page_size': page_size,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })

