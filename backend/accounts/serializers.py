from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
import phonenumbers
from .models import OTP, Address, User
from .utils import create_and_send_phone_otp, create_and_send_email_otp, validate_phone_with_country
from life.serializers import CustomTokenObtainPairSerializer as BaseTokenSerializer
from .backends import EmailOrPhoneBackend

CustomerUser = User

class DashboardCustomerSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(read_only=True)

    class Meta:
        model = CustomerUser
        fields = (
            'id', 'full_name', 'phone', 'email',
            'is_phone_verified', 'is_email_verified',
            'phone_verified_at', 'email_verified_at', 'date_joined',
            'notes', 'is_suspended', 'suspension_reason', 'is_restricted', 'restriction_reason', 'custom_notification',
            'allow_global_discount',
            'is_discount_active',
            'special_discount_percentage',
            'special_discount_type',
            'special_discount_amount',
            'discount_applies_to_services',
            'discount_start_date', 'discount_end_date', 'discount_custom_message',
            'discount_max_animals', 'discount_used_animals', 'global_discount_used_animals',
            'voucher_used_in_order_id', 'voucher_used_at',
            'is_corporate', 'business_name',
            'display_name',
        )

    def get_display_name(self, obj):
        is_corporate = getattr(obj, 'is_corporate', False)
        business_name = getattr(obj, 'business_name', '')

        if is_corporate and business_name:
            return f"{business_name} ({obj.full_name})"
        return obj.full_name

class MyTokenObtainPairSerializer(BaseTokenSerializer):
    def validate(self, attrs):
        identifier = attrs.get('phone')
        password = attrs.get('password')

        if not identifier or not password:
            raise AuthenticationFailed(_('Must include "identifier" and "password".'), code='authorization')

        backend = EmailOrPhoneBackend()
        user = backend.authenticate(request=self.context.get('request'), username=identifier, password=password)

        if not user:
            raise AuthenticationFailed(_('No active account found with the given credentials'), code='authorization')

        if user.is_suspended:
            reason = user.custom_notification or _('Your account is suspended. Please contact support.')
            raise AuthenticationFailed(reason, code='account_suspended')

        refresh = self.get_token(user)
        data = {'refresh': str(refresh), 'access': str(refresh.access_token)}
        self.user = user
        return data

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ('user',)

class CheckAccountSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=255)
    country_code = serializers.CharField(required=False, default='+20')

    def validate(self, attrs):
        identifier = attrs.get('identifier', '').strip()
        country_code = attrs.get('country_code', '+20').replace('+', '')
        is_email = '@' in identifier
        user = None

        if is_email:
            user = CustomerUser.objects.filter(email__iexact=identifier).first()
        else:
            try:
                phone_number = phonenumbers.parse(identifier, country_code)
                if not phonenumbers.is_valid_number(phone_number):
                    raise serializers.ValidationError({"identifier": _("Invalid phone number for this country.")})
                phone_e164 = phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164)
                user = CustomerUser.objects.filter(phone=phone_e164).first()
                attrs['formatted_phone'] = phone_e164
            except phonenumbers.NumberParseException:
                raise serializers.ValidationError({"identifier": _("Invalid phone number format.")})

        attrs['user'] = user
        attrs['is_email'] = is_email
        return attrs

class RegisterSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    country_code = serializers.CharField(write_only=True, default='+20')

    governorate = serializers.CharField(write_only=True, required=True)
    city = serializers.CharField(write_only=True, required=True)
    street = serializers.CharField(write_only=True, required=True)

    is_corporate = serializers.BooleanField(write_only=True, required=False, default=False)
    business_name = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CustomerUser
        fields = [
            'full_name', 'phone', 'email', 'password', 'country_code',
            'governorate', 'city', 'street', 'is_corporate', 'business_name'
        ]

    def validate_phone(self, value):
        country_code = self.initial_data.get('country_code', '+20').replace('+', '')
        try:
            phone_number = phonenumbers.parse(value, country_code)
            if not phonenumbers.is_valid_number(phone_number):
                raise serializers.ValidationError(_("رقم الهاتف غير صالح لهذا البلد."))
            phone_e164 = phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164)
            if CustomerUser.objects.filter(phone=phone_e164, is_phone_verified=True).exists():
                raise serializers.ValidationError(_("هذا الرقم مسجل ومفعل بالفعل."))
            return phone_e164
        except phonenumbers.NumberParseException:
            raise serializers.ValidationError(_("صيغة رقم الهاتف غير صحيحة."))

    def validate_email(self, value):
        if not value or str(value).strip() == "":
            return None

        qs = CustomerUser.objects.filter(email__iexact=value, is_email_verified=True)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(_("هذا البريد مسجل ومفعل لحساب آخر."))
        return value

    def validate(self, data):
        is_corporate = data.get('is_corporate', False)
        business_name = data.get('business_name', '').strip() if data.get('business_name') else ''

        if is_corporate and not business_name:
            raise serializers.ValidationError({
                'business_name': _("Business name is required for corporate accounts.")
            })

        if business_name and not is_corporate:
            data['is_corporate'] = True

        return data

    def create(self, validated_data):
        country_code = validated_data.pop('country_code', '+20')
        phone = validated_data.get('phone')
        password = validated_data.pop('password')

        governorate = validated_data.pop('governorate')
        city = validated_data.pop('city')
        street = validated_data.pop('street')

        is_corporate = validated_data.pop('is_corporate', False)
        business_name = validated_data.pop('business_name', None)

        user_data = {k: v for k, v in validated_data.items()}

        user_data.update({
            'is_corporate': is_corporate,
            'business_name': business_name if business_name and business_name.strip() else None
        })

        email_to_claim = user_data.get('email')
        if email_to_claim:
            CustomerUser.objects.filter(email__iexact=email_to_claim).update(email=None)

        with transaction.atomic():
            user, created = CustomerUser.objects.update_or_create(
                phone=phone,
                defaults={
                    **user_data,
                    'is_active': False,
                    'is_phone_verified': False,
                    'is_email_verified': False if 'email' in user_data else True,
                    'phone_country': country_code.replace('+', '')
                }
            )
            user.set_password(password)
            user.save()

            Address.objects.create(
                user=user,
                governorate=governorate,
                city=city,
                street=street,
                is_default=True
            )

        create_and_send_phone_otp(user, OTP.OTPType.PHONE_VERIFICATION)
        if user.email:
            create_and_send_email_otp(user, OTP.OTPType.EMAIL_VERIFICATION)

        return user

class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone = attrs.get('phone')
        email = attrs.get('email')
        if not (phone or email):
            raise serializers.ValidationError(_("Phone number or email must be provided."))
        try:
            if phone:
                user = CustomerUser.objects.get(phone=phone)
                otp_type = OTP.OTPType.PHONE_VERIFICATION
            else:
                user = CustomerUser.objects.get(email__iexact=email)
                otp_type = OTP.OTPType.EMAIL_VERIFICATION
            otp = OTP.objects.filter(user=user, code=attrs['code'], type=otp_type, is_used=False).latest('created_at')
            if not otp.is_valid():
                raise serializers.ValidationError(_("Code is expired or already used."))
            attrs['otp'] = otp
            attrs['user'] = user
            attrs['otp_type'] = otp_type
            return attrs
        except (CustomerUser.DoesNotExist, OTP.DoesNotExist):
            raise serializers.ValidationError(_("Invalid code or input data."))

class MeSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    is_corporate_account = serializers.SerializerMethodField()

    class Meta:
        model = CustomerUser
        fields = (
            'id', 'full_name', 'phone', 'email',
            'is_phone_verified', 'is_email_verified',
            'special_discount_percentage', 'discount_applies_to_services',
            'allow_global_discount', 'is_discount_active',
            'discount_start_date', 'discount_end_date', 'discount_custom_message',
            'is_corporate', 'business_name',
            'display_name', 'is_corporate_account',
            'special_discount_type', 'special_discount_amount',
            'discount_max_animals', 'discount_used_animals', 'global_discount_used_animals'
        )
        read_only_fields = fields

    def get_display_name(self, obj):
        is_corporate = getattr(obj, 'is_corporate', False)
        business_name = getattr(obj, 'business_name', '')

        if is_corporate and business_name:
            return f"{business_name} ({obj.full_name})"
        return obj.full_name

    def get_is_corporate_account(self, obj):
        is_corporate = getattr(obj, 'is_corporate', False)
        business_name = getattr(obj, 'business_name', '')

        return is_corporate and business_name and len(business_name.strip()) > 0

class UpdateProfileSerializer(serializers.ModelSerializer):
    is_corporate = serializers.BooleanField(required=False)
    business_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CustomerUser
        fields = ('full_name', 'email', 'is_corporate', 'business_name')

    def validate_email(self, value):
        if not value or str(value).strip() == "":
            return None
        if CustomerUser.objects.exclude(pk=self.instance.pk).filter(email__iexact=value, is_email_verified=True).exists():
            raise serializers.ValidationError(_("هذا البريد مسجل ومفعل لحساب آخر."))
        return value

    def validate(self, data):
        is_corporate = data.get('is_corporate')
        business_name = data.get('business_name')

        if is_corporate is True:
            if business_name is None or (isinstance(business_name, str) and not business_name.strip()):
                raise serializers.ValidationError({
                    'business_name': _("Business name is required for corporate accounts.")
                })

        if business_name and business_name.strip():
            if not self.instance.is_corporate:
                data['is_corporate'] = True

        return data

    def update(self, instance, validated_data):
        if 'email' in validated_data and (not validated_data['email'] or str(validated_data['email']).strip() == ""):
            validated_data['email'] = None

        original_email = instance.email
        new_email = validated_data.get('email')

        is_corporate = validated_data.get('is_corporate')
        business_name = validated_data.get('business_name')

        if is_corporate is not None:
            instance.is_corporate = is_corporate

        if business_name is not None:
            instance.business_name = business_name.strip() if business_name else None

        if new_email is not None and new_email != original_email:
            CustomerUser.objects.exclude(pk=instance.pk).filter(email__iexact=new_email).update(email=None)

        instance = super().update(instance, validated_data)

        if new_email is not None and new_email != original_email:
            instance.is_email_verified = False
            instance.save(update_fields=['is_email_verified'])
            if instance.email:
                try:
                    create_and_send_email_otp(instance, OTP.OTPType.EMAIL_VERIFICATION)
                except Exception as e:
                    print(f"Warning: OTP Email failed to send. Error: {e}")

        return instance

class RequestPasswordResetSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=255)

    def validate(self, attrs):
        identifier = attrs.get('identifier', '').strip()
        if not identifier:
            raise serializers.ValidationError({'identifier': _('Phone number is required.')})
        if '@' in identifier:
            raise serializers.ValidationError({'identifier': _('Only registered phone number is allowed.')})

        try:
            normalized_phone = validate_phone_with_country('EG', identifier)
            if not normalized_phone:
                raise serializers.ValidationError({'identifier': _('Invalid phone number format.')})
        except ValueError:
            raise serializers.ValidationError({'identifier': _('صيغة رقم الهاتف المدخل غير صحيحة.')})

        user = CustomerUser.objects.filter(phone=normalized_phone).first()
        if not user:
            raise serializers.ValidationError({'identifier': _('لا يوجد حساب مرتبط بهذا الرقم.')})

        attrs['user'] = user
        attrs['formatted_phone'] = normalized_phone
        return attrs

class VerifyPasswordResetOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone = attrs.get('phone')
        email = attrs.get('email')
        if not (phone or email):
            raise serializers.ValidationError(_("Phone number or email must be provided."))
        try:
            if phone:
                phone_e164 = validate_phone_with_country('EG', phone)
                user = CustomerUser.objects.get(phone=phone_e164)
                otp_type = OTP.OTPType.PASSWORD_RESET
            else:
                user = CustomerUser.objects.get(email__iexact=email)
                otp_type = OTP.OTPType.PASSWORD_RESET
            otp = OTP.objects.filter(user=user, code=attrs['code'], type=otp_type, is_used=False).latest('created_at')
            if not otp.is_valid():
                raise serializers.ValidationError(_("Code is expired or already used."))
            attrs['user'] = user
            attrs['otp'] = otp
            return attrs
        except (CustomerUser.DoesNotExist, OTP.DoesNotExist):
            raise serializers.ValidationError(_("Invalid code or input data."))

class SetNewPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_new_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, attrs):
        token = attrs.get('token')
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str
        try:
            uid_b64, reset_token = token.split('-', 1)
            uid = force_str(urlsafe_base64_decode(uid_b64))
            user = CustomerUser.objects.get(pk=uid)
        except (ValueError, TypeError, CustomerUser.DoesNotExist):
            raise serializers.ValidationError(_("الرابط غير صالح."))
        if not default_token_generator.check_token(user, reset_token):
            raise serializers.ValidationError(_("انتهت صلاحية الرابط أو تم استخدامه."))
        attrs['user'] = user
        return attrs

