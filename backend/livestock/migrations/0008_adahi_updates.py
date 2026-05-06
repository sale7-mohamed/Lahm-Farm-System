
# Generated manually

from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('livestock', '0007_category_image'),
        ('accounts', '0007_user_allow_global_discount_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='animal',
            name='is_adahi_pool',
            field=models.BooleanField(default=False, help_text='إذا تم تفعيله، سيظهر هذا الحيوان في القسم الثاني (مشاركة عامة) في صفحة الأضاحي.', verbose_name='ضمن مسبح الأضاحي العام'),
        ),
        migrations.CreateModel(
            name='AdahiGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=10, unique=True, verbose_name='كود المجموعة')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('animal', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='private_adahi_group', to='livestock.animal', verbose_name='الحيوان')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_adahi_groups', to='accounts.user')),
            ],
        ),
    ]

