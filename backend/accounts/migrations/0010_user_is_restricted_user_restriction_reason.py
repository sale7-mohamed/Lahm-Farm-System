from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies =[ ('accounts', '0009_user_discount_max_animals_user_discount_used_animals_and_more'), ]
    operations =[
        migrations.AddField(model_name='user', name='is_restricted', field=models.BooleanField(default=False, verbose_name='مقيّد من الطلب')),
        migrations.AddField(model_name='user', name='restriction_reason', field=models.TextField(blank=True, null=True, verbose_name='سبب التقييد')),
    ]

