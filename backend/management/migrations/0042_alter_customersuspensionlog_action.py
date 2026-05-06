from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies =[ ('management', '0041_alter_chatmessage_attachment'), ]
    operations =[
        migrations.AlterField(
            model_name='customersuspensionlog',
            name='action',
            field=models.CharField(choices=[('suspended', 'إيقاف'), ('activated', 'تفعيل'), ('restricted', 'تقييد'), ('unrestricted', 'فك التقييد')], max_length=20, verbose_name='الإجراء'),
        ),
    ]

