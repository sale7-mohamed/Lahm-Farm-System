import os
import uuid
import random
import string
from io import BytesIO
from datetime import date, timedelta
from decimal import Decimal
import time
import logging

import ffmpeg
import imageio_ffmpeg
import tempfile
import qrcode
from PIL import Image, ImageDraw, ImageFont
from dateutil.relativedelta import relativedelta
from unidecode import unidecode

from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.core.files.uploadedfile import InMemoryUploadedFile, UploadedFile
from django.utils.translation import gettext_lazy as _
from django.db.models import Sum
from django.core.exceptions import ValidationError

from core.models import Governorate, OperationSettings
from .utils.watermark import apply_image_watermark

logger = logging.getLogger(__name__)

def validate_file_extension(value):
    ext = os.path.splitext(value.name)[1]
    valid_extensions =['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.avi', '.mkv']
    if ext.lower() not in valid_extensions:
        raise ValidationError('نوع الملف غير مدعوم. المسموح: صور أو فيديوهات.')
    try:
        import magic  # type: ignore
        mime_type = magic.from_buffer(value.read(1024), mime=True)
        value.seek(0)
        if not mime_type.startswith('image/') and not mime_type.startswith('video/'):
            raise ValidationError('محتوى الملف غير صالح.')
    except ImportError:
        pass

def _safe_code(code):
    if not code:
        return "no-code"
    return "".join(ch if ch.isalnum() else "_" for ch in str(code))

def _dated_upload_path(prefix, dt, code, filename, category_name=None):
    code_clean = _safe_code(code)
    base, ext = os.path.splitext(filename)
    unique = uuid.uuid4().hex[:4]
    cat_clean = _safe_code(category_name) if category_name else "Animal"
    new_filename = f"lahm_{cat_clean}_{code_clean}_{unique}{ext.lower()}"
    return f"{prefix}/{dt:%Y/%m/%d}/{code_clean}/{new_filename}"

def animal_main_upload(instance, filename):
    dt = getattr(instance, "created_at", None) or timezone.now()
    cat_name = instance.category.name_en if instance.category else None
    return _dated_upload_path("livestock", dt, getattr(instance, "code", None), filename, cat_name)

def animal_image_upload(instance, filename):
    animal = instance.animal
    dt = getattr(animal, "created_at", None) or timezone.now()
    cat_name = animal.category.name_en if animal.category else None
    return _dated_upload_path("livestock", dt, getattr(animal, "code", None), filename, cat_name)

def animal_qr_code_upload(instance, filename):
    dt = getattr(instance, "created_at", None) or timezone.now()
    return _dated_upload_path("qrcodes", dt, getattr(instance, "code", None), filename, "QR")

def category_image_upload(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"lahm_Category_{instance.slug}.{ext}"
    return f"categories/{filename}"

def animal_video_upload(instance, filename):
    dt = getattr(instance, "created_at", None) or timezone.now()
    cat_name = instance.category.name_en if instance.category else None
    return _dated_upload_path("livestock_videos", dt, getattr(instance, "code", None), filename, cat_name)

class Category(models.Model):
    class LogicType(models.TextChoices):
        SHEEP = 'sheep', _('ضأن (خروف)')
        GOAT = 'goat', _('ماعز')
        COW = 'cow', _('بقر/جاموس')
        CAMEL = 'camel', _('إبل (جمال)')
        OTHER = 'other', _('غير محدد / أخرى')

    name_ar = models.CharField(max_length=50, unique=True, verbose_name="الاسم (عربي)")
    name_en = models.CharField(max_length=50, unique=True, blank=True, verbose_name="الاسم (إنجليزي / منسوب للرابط)")
    slug = models.SlugField(max_length=60, unique=True, blank=True, verbose_name="الرابط (Slug)")
    image = models.ImageField(upload_to=category_image_upload, blank=True, null=True, verbose_name=_("صورة الفئة"))

    standard_birth_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name=_("تكلفة الولادة القياسية")
    )
    daily_care_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=50.00,
        verbose_name=_("تكلفة الرعاية اليومية")
    )
    default_max_shares = models.PositiveIntegerField(
        default=5,
        verbose_name=_("عدد الأسهم الافتراضي للتشارك العام")
    )

    weight_variance_limit = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name=_("مقدار تفاوت الوزن المسموح (كجم)")
    )
    free_care_days = models.PositiveIntegerField(default=4, verbose_name="أيام الرعاية المجانية")

    logic_type = models.CharField(
        max_length=10,
        choices=LogicType.choices,
        default=LogicType.OTHER,
        verbose_name=_("نوع المنطق الشرعي")
    )

    extra_delivery_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name=_("رسوم توصيل إضافية للرأس (جنيه)")
    )
    daily_delivery_limit = models.PositiveIntegerField(
        default=0,
        verbose_name=_("الحد الأقصى للتوصيل في اليوم (0 = غير محدود)")
    )

    allow_deposit = models.BooleanField(default=True, verbose_name="السماح بدفع العربون")
    min_deposit_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.20, verbose_name="نسبة العربون (حي)")
    service_deposit_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.50, verbose_name="نسبة العربون (مع الذبح)")

    enable_slaughter = models.BooleanField(default=True, verbose_name="تفعيل الذبح")
    slaughter_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="سعر الذبح")
    enable_cutting = models.BooleanField(default=True, verbose_name="تفعيل التقطيع")
    cutting_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="سعر التقطيع")
    enable_packaging = models.BooleanField(default=True, verbose_name="تفعيل التغليف")
    packaging_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="سعر التغليف")

    def _base_latin(self):
        src = self.name_ar or self.name_en or ""
        return unidecode(src).strip() or "category"

    def _uniqueify(self, field_name, base):
        candidate = base
        i = 2
        qs = Category.objects.all()
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        lookup = f"{field_name}__iexact" if field_name == "name_en" else field_name
        while qs.filter(**{lookup: candidate}).exists():
            candidate = f"{base}-{i}"
            i += 1
        return candidate

    def save(self, *args, **kwargs):
        if not self.name_en:
            base_en = self._base_latin().replace("-", " ").replace("_", " ")
            base_en = " ".join(base_en.split())[:50]
            self.name_en = self._uniqueify("name_en", base_en)
        if not self.slug:
            base_slug = slugify(self._base_latin()) or slugify(self.name_en) or "cat"
            self.slug = self._uniqueify("slug", base_slug)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name_ar

class CategoryGrowthRate(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='growth_rates')
    min_weight = models.DecimalField(max_digits=5, decimal_places=2, verbose_name=_("من وزن (كجم)"))
    max_weight = models.DecimalField(max_digits=5, decimal_places=2, verbose_name=_("إلى وزن (كجم)"))
    daily_increase = models.DecimalField(max_digits=4, decimal_places=3, verbose_name=_("معدل الزيادة اليومي (كجم)"))

    class Meta:
        ordering = ['min_weight']
        verbose_name = _("معدل نمو")
        verbose_name_plural = _("معدلات النمو")

    def __str__(self):
        return f"{self.category.name_ar}: {self.min_weight}-{self.max_weight}kg (+{self.daily_increase})"

class Animal(models.Model):
    STATUS_CHOICES = [
        ('available', 'متاح'), ('reserved', 'محجوز'),
        ('sold', 'مباع'), ('lost', 'مفقود/نافد')
    ]
    SEX_CHOICES = [('male', 'ذكر'), ('female', 'أنثى')]
    ENTRY_TYPE_CHOICES = [
        ('purchased', 'تم شراؤه'), ('born_on_farm', 'مولود بالمزرعة')
    ]

    unique_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=100, blank=True, verbose_name="اسم الحيوان")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='animals')

    location = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_("المكان في المزرعة")
    )

    source_farm = models.ForeignKey(
        'management.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("المزرعة الموردة (إن وجد)")
    )
    supplier_code = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name=_("كود الحيوان عند المورد")
    )
    internal_image = models.ImageField(
        upload_to='livestock_internal/',
        blank=True,
        null=True,
        verbose_name=_("صورة الإثبات للمورد (مخفية)")
    )
    internal_notes = models.TextField(
        blank=True,
        null=True,
        verbose_name=_("ملاحظات إدارية (لا تظهر للعميل)")
    )

    sex = models.CharField(max_length=10, choices=SEX_CHOICES)
    birth_date = models.DateField(verbose_name="تاريخ الميلاد")

    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPE_CHOICES, default='purchased', verbose_name=_("مصدر الحيوان"))
    mother = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='offspring_mother', limit_choices_to={'sex': 'female'}, verbose_name=_("الأم"))
    father = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='offspring_father', limit_choices_to={'sex': 'male'}, verbose_name=_("الأب"))

    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_("التكلفة الدفترية (سعر الشراء أو تكلفة الولادة)"))

    breed = models.CharField(max_length=100, blank=True, null=True)
    price_egp = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_egp = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="مبلغ العربون الافتراضي للحيوان (إذا لم يُحدد نسبة)")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="نسبة الخصم (%)")
    is_offer = models.BooleanField(default=False, help_text="هل الحيوان عليه عرض؟")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='available', db_index=True)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to=animal_main_upload, blank=True, null=True, verbose_name=_("الصورة الرئيسية / الكافر"))
    video = models.FileField(upload_to=animal_video_upload, blank=True, null=True, verbose_name=_("فيديو الحيوان"))
    qr_code_image = models.ImageField(upload_to=animal_qr_code_upload, blank=True, null=True, verbose_name="صورة QR Code")

    is_shareable = models.BooleanField(
        default=False,
        verbose_name=_("قابل للتشارك (للعرض فقط)")
    )

    first_sale_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("تاريخ أول بيع")
    )

    is_hidden_from_store = models.BooleanField(
        default=False,
        verbose_name=_("إخفاء من المتجر")
    )
    has_defect = models.BooleanField(
        default=False,
        verbose_name=_("به عيب شرعي")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        is_new = self._state.adding

        # Check for discount activation
        old_instance = None
        if self.pk:
            try:
                old_instance = Animal.objects.get(pk=self.pk)
            except Animal.DoesNotExist:
                pass

        new_video_uploaded = False
        if self.pk:
            try:
                old_instance_for_video = Animal.objects.get(pk=self.pk)
                if old_instance_for_video.video != self.video:
                    new_video_uploaded = True
            except Animal.DoesNotExist:
                pass
        elif self.video:
            new_video_uploaded = True

        if self.category and self.category.logic_type not in ['camel']:
            self.is_shareable = True

        if is_new and not self.code:
            category_prefix = self.category.slug[:3].upper() if self.category.slug else 'GEN'
            birth_year_str = self.birth_date.strftime('%y')
            birth_month_str = self.birth_date.strftime('%m')

            max_attempts = 100
            for attempt in range(max_attempts):
                sequence_count = Animal.objects.filter(
                    category=self.category,
                    birth_date__year=self.birth_date.year,
                    birth_date__month=self.birth_date.month
                ).count()

                sequence = sequence_count + 1 + attempt
                sequence_str = f"{sequence:04d}"

                potential_code = f"{category_prefix} {birth_year_str} {birth_month_str} {sequence_str}"

                if not Animal.objects.filter(code=potential_code).exists():
                    self.code = potential_code
                    break

                time.sleep(0.05)
            else:
                random_suffix = uuid.uuid4().hex[:4].upper()
                self.code = f"{category_prefix} {birth_year_str} {birth_month_str} {random_suffix}"

        if is_new and self.entry_type == 'born_on_farm' and self.purchase_price == 0:
            self.purchase_price = self.category.standard_birth_cost

        is_new_main_image = False
        try:
            if self.image and getattr(self.image, 'file', None) and isinstance(self.image.file, UploadedFile):
                is_new_main_image = True
        except Exception:
            pass

        if self.image and (is_new or is_new_main_image or 'image' in (kwargs.get('update_fields') or [])):
            from livestock.utils.watermark import apply_image_watermark
            self.image = apply_image_watermark(self.image, self.code)

        super().save(*args, **kwargs)

        if new_video_uploaded and self.video:
            from livestock.utils.watermark import apply_video_watermark
            import os
            from django.conf import settings

            old_video_path = self.video.path
            new_video_path = apply_video_watermark(old_video_path, self.code)

            if new_video_path != old_video_path:
                rel_path = os.path.relpath(new_video_path, settings.MEDIA_ROOT)
                self.video.name = rel_path

                if os.path.exists(old_video_path):
                    os.remove(old_video_path)

                super().save(update_fields=['video'])

        if new_video_uploaded and self.video and not self.image:
            try:
                self.generate_video_thumbnail()
                super().save(update_fields=['image'])
            except Exception as e:
                logger.error(f"Failed to generate video thumbnail for {self.code}: {e}")

        if is_new and not self.qr_code_image:
            try:
                self.generate_and_save_qr_code()
            except Exception as e:
                logger.error(f"Failed to generate QR code for {self.code}: {e}")

        # Send notification if offer was activated
        if old_instance:
            if not old_instance.is_offer and self.is_offer and self.discount_percent > 0:
                from notifications.utils import send_global_notification
                send_global_notification(
                    title=f"🎉 عرض لا يفوتك على {self.category.name_ar}!",
                    message=f"تم تطبيق خصم {self.discount_percent}% على الماشية كود #{self.code}.      ‍️",
                    category="livestock"
                )

    def generate_video_thumbnail(self):
        if not self.video:
            return

        try:
            input_path = self.video.path
            output_filename = f"thumb_{uuid.uuid4().hex[:8]}.jpg"
            output_path_temp = os.path.join(tempfile.gettempdir(), output_filename)
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

            (
                ffmpeg
                .input(input_path, ss=1)
                .output(output_path_temp, vframes=1, format='image2', vcodec='mjpeg')
                .overwrite_output()
                .run(cmd=ffmpeg_exe, capture_stdout=True, capture_stderr=True)
            )

            with open(output_path_temp, 'rb') as f:
                self.image.save(output_filename, f, save=False)

            os.remove(output_path_temp)

        except ffmpeg.Error as e:
            logger.error('FFmpeg stdout: %s', e.stdout.decode('utf8') if e.stdout else '')
            logger.error('FFmpeg stderr: %s', e.stderr.decode('utf8') if e.stderr else '')
            raise
        except Exception as e:
            logger.error(f"Could not process video thumbnail: {e}")

    @property
    def detailed_display_status(self):
        if self.status == 'sold':
            return {'label': 'مباع', 'color': 'danger', 'details': 'تم بيع هذا الحيوان بالكامل.'}

        if self.status == 'lost':
            return {'label': 'نافد/مفقود', 'color': 'dark', 'details': 'غير متاح في المخزون.'}

        if self.status == 'reserved':
            return {'label': 'محجوز', 'color': 'warning', 'details': 'محجوز (انتظار الدفع أو التسليم).'}

        if self.status == 'available':
            active_listings = self.listings.filter(is_active=True)
            locations = []

            for listing in active_listings:
                if listing.pipeline == 'M':
                    locations.append('بيع كامل')
                elif listing.pipeline == 'S':
                    if listing.section == 'adahi_pool':
                        locations.append('مسبح أضاحي')
                    elif listing.section == 'adahi_full':
                        locations.append('أضحية كاملة')
                    elif listing.section == 'adahi_group':
                        locations.append('مجموعة خاصة')
                elif listing.pipeline == 'G':
                    locations.append('تشارك عام')

            location_text = " + ".join(locations) if locations else "مخزون"

            if active_listings.count() == 1:
                listing = active_listings.first()
                if listing.pipeline == 'M':
                    location_text = 'بيع كامل'
                elif listing.pipeline == 'S':
                    if listing.section == 'adahi_pool':
                        location_text = 'مسبح أضاحي'
                    elif listing.section == 'adahi_full':
                        location_text = 'أضحية كاملة'
                    elif listing.section == 'adahi_group':
                        location_text = 'مجموعة خاصة'
                elif listing.pipeline == 'G':
                    location_text = 'تشارك عام'

            return {
                'label': 'متاح' if active_listings.count() <= 1 else 'متاح (متعدد)',
                'color': 'primary',
                'details': f'متاح في: {location_text}'
            }

        return {'label': self.status, 'color': 'secondary', 'details': ''}

    @property
    def remaining_shares(self):
        active_listing = self.listings.filter(is_active=True).first()
        if active_listing:
            return active_listing.available_shares
        return 0

    @property
    def display_max_shares(self):
        return 1

    @property
    def operates_as_shares(self):
        return False

    @property
    def current_weight(self):
        last_weight = self.weight_logs.order_by('-date', '-id').first()
        return last_weight.weight_kg if last_weight else None

    @property
    def last_weight_date(self):
        last_weight = self.weight_logs.order_by('-date').first()
        return last_weight.date if last_weight else None

    @property
    def is_sacrifice_valid_now(self):
        if self.has_defect:
            return False

        age = self.age_months
        logic = self.category.logic_type
        weight = self.current_weight or 0

        if logic == Category.LogicType.SHEEP:
            return age >= 6 and weight >= 40

        elif logic == Category.LogicType.GOAT:
            return age >= 12

        elif logic == Category.LogicType.COW:
            return age >= 24

        elif logic == Category.LogicType.CAMEL:
            return age >= 60

        return False

    @property
    def operates_in_pipelines(self):
        pipelines = []

        if (not self.is_hidden_from_store and
                self.status == 'available' and
                not self.has_defect):
            pipelines.append('M')

        if (not self.has_defect and
                self.category.logic_type in ['sheep', 'goat', 'cow', 'camel'] and
                self.is_sacrifice_valid_now and
                self.status == 'available' and
                not self.is_hidden_from_store):
            pipelines.append('S')

        if (self.is_shareable and
                self.category.logic_type != 'camel' and
                self.status == 'available' and
                not self.is_hidden_from_store and
                not self.has_defect):
            pipelines.append('G')

        return pipelines

    @property
    def total_listed_shares(self):
        total = self.listings.filter(is_active=True).aggregate(
            total=Sum('total_shares')
        )['total'] or 0

        return total

    def get_available_sections(self, pipeline):
        sections = []

        if pipeline == 'M':
            sections.append('full_sale')

        elif pipeline == 'S':
            if self.category.logic_type in ['cow', 'camel']:
                sections.append('adahi_pool')
            sections.append('adahi_full')

        elif pipeline == 'G':
            sections.append('shares')

        return sections

    def get_eid_prediction(self):
        try:
            settings = OperationSettings.load()
            if not settings.eid_adha_date:
                return None

            today = date.today()
            eid_date = settings.eid_adha_date.date()

            if eid_date < today:
                return {"status": "expired", "message": "انتهى العيد"}

            days_remaining = (eid_date - today).days
            current_weight = self.current_weight or 0
            predicted_weight = current_weight

            rates = self.category.growth_rates.all()
            growth_rate = 0
            for rate in rates:
                if rate.min_weight <= current_weight <= rate.max_weight:
                    growth_rate = rate.daily_increase
                    break

            if growth_rate == 0 and rates.exists():
                last_rate = rates.last()
                if current_weight > last_rate.max_weight:
                    growth_rate = last_rate.daily_increase

            total_increase = growth_rate * days_remaining
            predicted_weight = current_weight + total_increase

            birth = self.birth_date
            r = relativedelta(eid_date, birth)
            age_at_eid = r.years * 12 + r.months

            is_valid = False
            logic = self.category.logic_type

            if self.has_defect:
                is_valid = False
            elif logic == Category.LogicType.SHEEP:
                is_valid = age_at_eid >= 6 and predicted_weight >= 40
            elif logic == Category.LogicType.GOAT:
                is_valid = age_at_eid >= 12
            elif logic == Category.LogicType.COW:
                is_valid = age_at_eid >= 24
            elif logic == Category.LogicType.CAMEL:
                is_valid = age_at_eid >= 60

            return {
                "days_remaining": days_remaining,
                "predicted_weight": round(predicted_weight, 2),
                "age_at_eid": age_at_eid,
                "is_valid": is_valid,
                "daily_increase": growth_rate
            }
        except Exception as e:
            logger.error(f"Error in get_eid_prediction for animal {self.id}: {e}")
            return {"error": "فشل في حساب التنبؤ"}

    @property
    def age_months(self):
        today = date.today()
        delta = relativedelta(today, self.birth_date)
        return delta.years * 12 + delta.months

    @property
    def has_discount(self):
        return self.is_offer and self.discount_percent > 0

    @property
    def price_after_discount(self):
        if self.has_discount:
            discount_amount = (self.price_egp * self.discount_percent) / Decimal('100')
            return (self.price_egp - discount_amount).quantize(Decimal('0.01'))
        return self.price_egp

    def generate_and_save_qr_code(self):
        qr_data = f"http://127.0.0.1:8000/api/livestock/q/{self.unique_id}"
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color='black', back_color='white').convert('RGB')
        qr_width, qr_height = qr_img.size
        header_height = 60
        new_height = qr_height + header_height
        final_image = Image.new('RGB', (qr_width, new_height), 'white')
        draw = ImageDraw.Draw(final_image)
        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except IOError:
            font = ImageFont.load_default()

        text = self.code or "NO-CODE"
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        text_x = (qr_width - text_width) / 2
        text_y = (header_height - text_height) / 2
        draw.text((text_x, text_y), text, fill="black", font=font)
        final_image.paste(qr_img, (0, header_height))
        buffer = BytesIO()
        final_image.save(buffer, format='PNG')
        buffer.seek(0)
        file_name = f'qr_tag_{self.code or self.unique_id}.png'
        self.qr_code_image.save(
            file_name,
            InMemoryUploadedFile(buffer, 'ImageField', file_name, 'image/png', buffer.getbuffer().nbytes, None),
            save=True
        )

    class Meta:
        indexes = [
            models.Index(fields=['status', 'price_egp']),
            models.Index(fields=['status']),
            models.Index(fields=['status', 'birth_date']),
            models.Index(fields=['status', 'category']),
            models.Index(fields=['is_offer']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.code} - {self.category.name_ar}"

    def has_partial_sales(self):
        has_orders = self.orderitem_set.filter(
            order__status__in=[
                'pending', 'confirmed', 'processing', 'ready_for_shipment',
                'shipped', 'delivered', 'completed'
            ]
        ).exists()

        has_reservations = False
        if hasattr(self, 'reservations'):
            has_reservations = self.reservations.filter(
                status__in=['confirmed', 'completed']
            ).exists()

        return has_orders or has_reservations

class AnimalListing(models.Model):
    PIPELINE_CHOICES = [
        ('M', 'سوق المواشي'),
        ('S', 'الأضاحي'),
        ('G', 'تشارك عام'),
    ]

    SECTION_CHOICES = [
        ('full_sale', 'بيع كامل'),
        ('adahi_pool', 'مسبح أضاحي'),
        ('adahi_full', 'أضحية كاملة'),
        ('adahi_group', 'مجموعة خاصة'),
        ('shares', 'تشارك لحم'),
    ]

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='listings')
    pipeline = models.CharField(max_length=1, choices=PIPELINE_CHOICES, verbose_name="الماسورة")
    section = models.CharField(max_length=20, choices=SECTION_CHOICES, verbose_name="القسم")

    total_shares = models.PositiveIntegerField(default=1, verbose_name="عدد الأسهم الكلي")
    available_shares = models.PositiveIntegerField(default=1, verbose_name="الأسهم المتاحة")

    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر في هذا القسم")
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    paused_due_to_order = models.BooleanField(default=False, verbose_name="موقوف مؤقتاً بسبب طلب")

    group_code = models.CharField(max_length=10, blank=True, null=True, verbose_name="كود المجموعة")
    group_creator = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="منشئ المجموعة"
    )
    group_expires_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ انتهاء المجموعة")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['animal', 'pipeline', 'section']
        verbose_name = "عرض بيع (ماسورة)"
        verbose_name_plural = "عروض البيع (المواسير)"
        indexes = [
            models.Index(fields=['pipeline', 'section', 'is_active']),
            models.Index(fields=['animal', 'is_active']),
        ]

    def __str__(self):
        return f"{self.animal.code} - {self.get_pipeline_display()} ({self.get_section_display()})"

    @property
    def sku(self):
        return f"{self.animal.id}-{self.pipeline}-{self.section}-{self.total_shares}"

    @property
    def price_per_share(self):
        if self.total_shares > 0:
            return self.price / self.total_shares
        return self.price

    @property
    def is_group_active(self):
        if self.section != 'adahi_group':
            return False

        if not self.group_expires_at:
            return True

        return timezone.now() < self.group_expires_at

    def decrement_shares(self, quantity):
        if quantity > self.available_shares:
            raise ValueError("الكمية المطلوبة أكبر من الأسهم المتاحة")

        self.available_shares -= quantity
        self.save()

        if self.available_shares <= 0:
            self.is_active = False
            self.save()

class AdahiGroup(models.Model):
    code = models.CharField(max_length=10, unique=True, verbose_name=_("كود المجموعة"))
    listing = models.OneToOneField(AnimalListing, on_delete=models.CASCADE, related_name='adahi_group',
                                    limit_choices_to={'section': 'adahi_group'})
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='created_adahi_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name=_("وقت انتهاء المجموعة"))

    def save(self, *args, **kwargs):
        if not self.code:
            code_generated = False
            for _ in range(10):
                potential_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                if not AdahiGroup.objects.filter(code=potential_code).exists():
                    self.code = potential_code
                    code_generated = True
                    break

            if not code_generated:
                self.code = f"GRP{uuid.uuid4().hex[:6].upper()}"

        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Group {self.code} for {self.listing.animal.code}"

    @property
    def animal(self):
        return self.listing.animal

class AnimalImage(models.Model):
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='images')
    image = models.FileField(
        upload_to=animal_image_upload,
        validators=[validate_file_extension],
        verbose_name="ملف (صورة/فيديو)"
    )
    order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")

    class Meta:
        ordering = ['order', 'id']

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        is_video = False

        if self.image:
            name = self.image.name.lower()
            if name.endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm')):
                is_video = True

        is_new_image = False
        try:
            if self.image and getattr(self.image, 'file', None) and isinstance(self.image.file, UploadedFile):
                is_new_image = True
        except Exception:
            pass

        if (is_new or is_new_image) and self.image and not is_video:
            from livestock.utils.watermark import apply_image_watermark
            self.image = apply_image_watermark(self.image, self.animal.code)

        super().save(*args, **kwargs)

        if (is_new or is_new_image) and self.image and is_video:
            from livestock.utils.watermark import apply_video_watermark
            import os
            from django.conf import settings

            old_path = self.image.path
            new_path = apply_video_watermark(old_path, self.animal.code)

            if new_path != old_path:
                rel_path = os.path.relpath(new_path, settings.MEDIA_ROOT)
                self.image.name = rel_path

                if os.path.exists(old_path):
                    os.remove(old_path)

                super().save(update_fields=['image'])

    def __str__(self):
        return f"ملف لـ {self.animal.code}"

    @property
    def is_video(self):
        name = self.image.name.lower()
        return name.endswith(('.mp4', '.mov', '.avi', '.mkv'))

class ClientServiceQuestion(models.Model):
    question_text = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    show_to_client = models.BooleanField(default=True)

    def __str__(self):
        return self.question_text

class ClientServiceOption(models.Model):
    question = models.ForeignKey(ClientServiceQuestion, related_name='options', on_delete=models.CASCADE)
    option_text = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.option_text} ({self.price})"

class DeliverySetting(models.Model):
    delivery_days = models.JSONField(default=list)
    pickup_days = models.JSONField(default=list)
    delivery_days_ahead = models.PositiveIntegerField(default=7)
    pickup_days_ahead = models.PositiveIntegerField(default=7)
    preparation_days = models.PositiveIntegerField(default=3, help_text=_("عدد أيام التحضير (حي)"))
    slaughter_preparation_days = models.PositiveIntegerField(default=4, help_text=_("عدد أيام التحضير (مذبوح)"))
    free_care_days = models.PositiveIntegerField(default=4)
    min_deposit_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.20')
    )
    service_deposit_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.50')
    )

    def get_dates(self, option):
        today = date.today()
        result = []
        start_day = today + timedelta(days=self.preparation_days)
        is_delivery = option in ["to_home", "delivery"]

        days_ahead = self.delivery_days_ahead if is_delivery else self.pickup_days_ahead
        allowed_days = self.delivery_days if is_delivery else self.pickup_days

        for i in range(days_ahead):
            day = start_day + timedelta(days=i)
            if day.strftime("%A") in allowed_days:
                result.append(day.strftime("%Y-%m-%d"))
        return result

class DeliveryArea(models.Model):
    governorate = models.OneToOneField(Governorate, on_delete=models.CASCADE, verbose_name="المحافظة")
    delivery_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="سعر التوصيل (جنيه)")
    is_active = models.BooleanField(default=True, verbose_name="ظاهر للعميل؟")

    class Meta:
        verbose_name = "منطقة توصيل"
        verbose_name_plural = "مناطق التوصيل"

    def __str__(self):
        return f"{self.governorate.name_ar} - {self.delivery_price} EGP"

class ServicePriceSetting(models.Model):
    name = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.price} جنيه"
