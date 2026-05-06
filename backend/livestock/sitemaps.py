# livestock/sitemaps.py
from django.contrib.sitemaps import Sitemap
from .models import Animal

class AnimalSitemap(Sitemap):
    changefreq = "daily"
    priority = 0.8
    protocol = 'https'

    def items(self):
        return Animal.objects.filter(status='available')

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        return f"/animal/{obj.unique_id}"

