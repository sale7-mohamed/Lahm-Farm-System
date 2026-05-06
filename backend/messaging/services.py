from datetime import timedelta
from django.utils import timezone
from accounts.services.otp_providers import get_general_sms_provider, get_otp_provider, clean_egyptian_phone
from .models import MessageLog, MessageTemplate
import string

class SafeDict(dict):
    def __missing__(self, key):
        return '{' + key + '}'

class MessagingService:
    @staticmethod
    def send_message(phone, content, msg_type='AUTOMATED', user=None):
        clean_phone = clean_egyptian_phone(phone)

        if len(clean_phone) < 10:
            MessageLog.objects.create(
                recipient=phone, content=content, message_type=msg_type,
                status='failed', provider_response="[النظام] مرفوض محلياً: طول رقم الهاتف غير صالح.", sent_by=user
            )
            return False

        time_threshold = timezone.now() - timedelta(minutes=60)
        if MessageLog.objects.filter(
            recipient=phone, content=content, message_type=msg_type,
            created_at__gte=time_threshold, status='sent'
        ).exists():
            return False

        if msg_type != 'OTP':
            time_threshold = timezone.now() - timedelta(minutes=60)
            if MessageLog.objects.filter(
                recipient=phone, content=content, message_type=msg_type,
                created_at__gte=time_threshold, status='sent'
            ).exists():
                return False

        if msg_type == 'OTP':
            provider = get_otp_provider()
        else:
            provider = get_general_sms_provider()

        provider_name = provider.__class__.__name__.replace('Provider', '')

        try:
            success, provider_resp = provider.send(clean_phone, content)
            status = 'sent' if success else 'failed'
            final_resp = f"[{provider_name}] {provider_resp}"
        except Exception as e:
            success = False
            status = 'failed'
            final_resp = f"[{provider_name}] خطأ في الاتصال: {str(e)}"

        MessageLog.objects.create(
            recipient=clean_phone, content=content, message_type=msg_type,
            status=status, provider_response=final_resp, sent_by=user
        )
        return success

    @staticmethod
    def send_template_message(phone, template_key, context=None, msg_type='AUTOMATED'):
        if context is None:
            context = {}
        try:
            template = MessageTemplate.objects.get(key=template_key, is_active=True)
            formatter = string.Formatter()
            content = formatter.vformat(template.content, (), SafeDict(context))
            return MessagingService.send_message(phone, content, msg_type)
        except MessageTemplate.DoesNotExist:
            return False

    @staticmethod
    def send_bulk_manual(phones_list, content, user):
        provider = get_general_sms_provider()
        provider_name = provider.__class__.__name__.replace('Provider', '')

        cleaned_phones = list(set([clean_egyptian_phone(p) for p in phones_list if len(clean_egyptian_phone(p)) >= 10]))
        if not cleaned_phones:
            return 0

        try:
            if hasattr(provider, 'send_batch'):
                response_data = provider.send_batch(cleaned_phones, content)
                is_success = False
                provider_desc = str(response_data)

                resp_str = str(response_data).lower()

                #  :    Mock   
                if provider_name == 'MockOTP':
                    is_success = True
                    provider_desc = "تم الإرسال وهمياً للكل (Mock)"
                elif 'received' in resp_str or 'success' in resp_str or 'true' in resp_str or 'ok' in resp_str:
                    is_success = True
                    #  :        ArpuPlus 
                    provider_desc = f"تم الإرسال بنجاح ({provider_name})"
                elif isinstance(response_data, dict):
                    status_val = response_data.get('status')
                    status_str = str(status_val).lower()
                    desc_str = str(response_data.get('status_description', '')).lower()
                    msg_str = str(response_data.get('message', '')).lower()

                    if status_val is True or status_str == 'true' or status_str == 'success' or 'received' in desc_str or 'success' in desc_str or 'received' in msg_str:
                        is_success = True
                        provider_desc = f"تم الإرسال بنجاح ({provider_name})"
                    else:
                        provider_desc = response_data.get('status_description') or response_data.get('message') or "فشل الإرسال الجماعي"
            else:
                is_success = True
                provider_desc = "مُرسل فردياً (Fallback)"

            final_resp = f"[{provider_name}] {provider_desc}"

        except Exception as e:
            is_success = False
            final_resp = f"[{provider_name}] خطأ تقني: {str(e)}"

        logs_to_create = [
            MessageLog(
                recipient=phone, content=content, message_type='MANUAL',
                status='sent' if is_success else 'failed',
                provider_response=final_resp, sent_by=user
            ) for phone in cleaned_phones
        ]
        MessageLog.objects.bulk_create(logs_to_create)
        return len(cleaned_phones) if is_success else 0

