import os
import base64
import logging
import requests
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

#   WhySMS
WHYSMS_RESPONSES = {
    "ok": "تم الإرسال بنجاح",
    "100": "خطأ في البوابة (Bad gateway)",
    "101": "إجراء خاطئ (Wrong action)",
    "102": "فشل المصادقة - تأكد من التوكن",
    "103": "رقم الهاتف غير صحيح",
    "104": "الرقم خارج التغطية",
    "105": "الرصيد غير كافٍ (Insufficient balance)",
    "Insufficient balance": "الرصيد غير كافٍ في حساب المزود",
    "Invalid phone number": "رقم الهاتف غير صحيح",
    "Authentication failed": "فشل المصادقة - تأكد من بيانات الربط"
}

def clean_egyptian_phone(phone_number):
    """        ( +  )"""
    clean_phone = str(phone_number).strip().lstrip('+')
    if len(clean_phone) == 10 and clean_phone.startswith(('10', '11', '12', '15')):
        clean_phone = '20' + clean_phone
    elif len(clean_phone) == 11 and clean_phone.startswith('01'):
        clean_phone = '20' + clean_phone[1:]
    return clean_phone

class BaseSMSProvider(ABC):

    @abstractmethod
    def send(self, phone_number: str, message: str) -> tuple[bool, str]:
        """  (   )"""
        pass

    @abstractmethod
    def get_info(self) -> dict:

        pass

    def send_otp(self, phone_number: str, code: str) -> bool:
        message = f"كود التحقق الخاص بك من متجر لَحِم هو: {code}"
        success, _ = self.send(phone_number, message)
        return success

# =====================================================================
# 1.   WE Telecom
# =====================================================================
class WeSMSProvider(BaseSMSProvider):
    def __init__(self):
        self.base_url = "https://weapi.connekio.com"
        self.username = os.getenv('WE_USERNAME')
        self.password = os.getenv('WE_PASSWORD')
        self.account_id = os.getenv('WE_ACCOUNT_ID')
        self.sender_id = os.getenv('WE_SENDER_ID', 'WE')

    def _get_headers(self):
        auth_string = f"{self.username}:{self.password}:{self.account_id}"
        return {
            'Authorization': f'Basic {base64.b64encode(auth_string.encode()).decode()}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    # Endpoint 1: Send Single SMS
    def send(self, phone_number: str, message: str) -> tuple[bool, str]:
        try:
            if not all([self.username, self.password, self.account_id, self.sender_id]):
                return False, "بيانات الربط لـ WE مفقودة من الإعدادات"

            clean_phone = clean_egyptian_phone(phone_number)
            payload = {
                "account_id": int(self.account_id),
                "text": message,
                "msisdn": clean_phone,
                "sender": self.sender_id
            }

            response = requests.post(f"{self.base_url}/sms/single", json=payload, headers=self._get_headers(), timeout=10)
            res_json = response.json()

            if res_json.get('status') is True:
                return True, "تم الإرسال بنجاح (WE)"
            return False, f"فشل: {res_json.get('status_description', 'خطأ')}"
        except Exception as e:
            logger.error(f"WE SMS error: {e}")
            return False, str(e)

    # Endpoint 2: Send Batch SMS
    def send_batch(self, phones_list: list, message: str) -> dict:
        try:
            mobile_list =[{"msisdn": clean_egyptian_phone(p)} for p in phones_list]
            payload = {
                "account_id": int(self.account_id),
                "sender": self.sender_id,
                "text": message,
                "mobile_list": mobile_list
            }
            response = requests.post(f"{self.base_url}/sms/batch", json=payload, headers=self._get_headers(), timeout=15)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    # Endpoint 3: Check Balance
    def get_info(self) -> dict:
        try:
            payload = {"account_id": int(self.account_id)}
            response = requests.post(f"{self.base_url}/account/balance", json=payload, headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {
                    "type": "WE Business",
                    "credit": data.get("credit"),
                    "currency": data.get("currency"),
                    "account_type": data.get("account_type")
                }
            return {"type": "error", "message": "فشل جلب الرصيد من WE"}
        except Exception as e:
            return {"type": "error", "message": str(e)}

    # Endpoint 4: Account Operators
    def get_operators(self) -> dict:
        try:
            payload = {"account_id": int(self.account_id)}
            response = requests.post(f"{self.base_url}/account/operators", json=payload, headers=self._get_headers(), timeout=10)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

# =====================================================================
# 2.   ArpuPlus
# =====================================================================
class ArpuPlusProvider(BaseSMSProvider):
    def __init__(self):
        self.base_url = "https://api.connekio.com"
        self.username = os.getenv('ARPU_USERNAME')
        self.password = os.getenv('ARPU_PASSWORD')
        self.account_id = os.getenv('ARPU_ACCOUNT_ID')
        self.sender_id = os.getenv('ARPU_SENDER_ID', 'ArpuPlus')

    def _get_headers(self):
        auth_string = f"{self.username}:{self.password}:{self.account_id}"
        return {
            'Authorization': f'Basic {base64.b64encode(auth_string.encode()).decode()}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    # Endpoint 1: Send Single SMS
    def send(self, phone_number: str, message: str) -> tuple[bool, str]:
        try:
            if not all([self.username, self.password, self.account_id, self.sender_id]):
                return False, "بيانات ArpuPlus غير مكتملة"

            clean_phone = clean_egyptian_phone(phone_number)
            payload = {
                "account_id": int(self.account_id),
                "text": message,
                "msisdn": clean_phone,
                "sender": self.sender_id
            }

            response = requests.post(f"{self.base_url}/sms/single", json=payload, headers=self._get_headers(), timeout=10)
            res_json = response.json()

            status_val = res_json.get('status')
            status_desc = str(res_json.get('status_description', '')).lower()

            if status_val is True or str(status_val).lower() == 'true':
                return True, "تم الإرسال بنجاح (ArpuPlus)"
            return False, f"فشل: {res_json.get('status_description', 'خطأ')}"
        except Exception as e:
            return False, f"خطأ في ArpuPlus: {str(e)}"

    # Endpoint 2: Send Batch SMS
    def send_batch(self, phones_list: list, message: str) -> dict:
        try:
            mobile_list = [{"msisdn": clean_egyptian_phone(p)} for p in phones_list]
            payload = {
                "account_id": int(self.account_id),
                "sender": self.sender_id,
                "text": message,
                "mobile_list": mobile_list
            }
            response = requests.post(f"{self.base_url}/sms/batch", json=payload, headers=self._get_headers(), timeout=15)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    # Endpoint 3: Check Balance
    def get_info(self) -> dict:
        try:
            payload = {"account_id": int(self.account_id)}
            response = requests.post(f"{self.base_url}/account/balance", json=payload, headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {
                    "type": "ArpuPlus",
                    "credit": data.get("credit"),
                    "currency": data.get("currency"),
                    "account_type": data.get("account_type")
                }
            return {"type": "error", "message": "فشل جلب الرصيد من ArpuPlus"}
        except Exception as e:
            return {"type": "error", "message": str(e)}

    # Endpoint 4: Account Operators
    def get_operators(self) -> dict:
        try:
            payload = {"account_id": int(self.account_id)}
            response = requests.post(f"{self.base_url}/account/operators", json=payload, headers=self._get_headers(), timeout=10)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

# =====================================================================
# 3.   WhySMS
# =====================================================================
class WhySMSProvider(BaseSMSProvider):
    def __init__(self):
        self.base_url = "https://bulk.whysms.com/api/v3"
        self.token = os.getenv('WHYSMS_API_TOKEN')
        self.sender_id = os.getenv('WHYSMS_SENDER_ID', 'WhySMS')

    def _get_headers(self):
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    # Endpoint 1: Send Single / Outbound SMS (Supports multiple via commas)
    def send(self, phone_number: str, message: str) -> tuple[bool, str]:
        try:
            if not self.token or not self.sender_id:
                return False, "بيانات WhySMS مفقودة"

            # WhySMS      
            phones =[clean_egyptian_phone(p) for p in phone_number.split(',')]
            clean_phones_str = ",".join(phones)

            payload = {
                "recipient": clean_phones_str,
                "sender_id": self.sender_id,
                "type": "plain",
                "message": message
            }

            response = requests.post(f"{self.base_url}/sms/send", json=payload, headers=self._get_headers(), timeout=15)

            #      (Cloudflare)
            if response.status_code not in [200, 201]:
                if "Cloudflare" in response.text or "<html" in response.text:
                    return False, f"مرفوضة من جدار الحماية (HTTP {response.status_code})"
                try:
                    error_msg = response.json().get('message', 'خطأ غير معروف')
                    return False, f"مرفوضة: {error_msg}"
                except:
                    return False, f"خطأ في السيرفر (HTTP {response.status_code})"

            res_json = response.json()
            if str(res_json.get('status')).lower() == 'success':
                return True, "تم الإرسال بنجاح (WhySMS)"
            else:
                error_status = str(res_json.get('status', ''))
                error_msg = str(res_json.get('message', 'خطأ غير معروف'))
                translated_error = WHYSMS_RESPONSES.get(error_status) or WHYSMS_RESPONSES.get(error_msg) or error_msg
                return False, f"مرفوضة: {translated_error}"

        except Exception as e:
            return False, f"خطأ غير متوقع: {str(e)}"

    # Helper method for Bulk SMS (Wraps the standard send)
    def send_batch(self, phones_list: list, message: str) -> tuple[bool, str]:
        """        WhySMS"""
        comma_separated_phones = ",".join(phones_list)
        return self.send(comma_separated_phones, message)

    # Endpoint 2: View an SMS by UID
    def get_sms_status(self, uid: str) -> dict:
        try:
            response = requests.get(f"{self.base_url}/sms/{uid}", headers=self._get_headers(), timeout=10)
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # Endpoint 3: View all messages (With Pagination)
    def get_info(self) -> dict:
        """      (  Endpoint )"""
        try:
            response = requests.get(f"{self.base_url}/sms", headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {"type": "WhySMS", "logs": data.get("data",[])}
            return {"type": "error", "message": "فشل جلب السجلات من WhySMS"}
        except Exception as e:
            return {"type": "error", "message": str(e)}

# =====================================================================
# 4.    (    )
# =====================================================================
class MockOTPProvider(BaseSMSProvider):
    def send(self, phone_number: str, message: str) -> tuple[bool, str]:
        print(f"[MOCK SMS] To: {phone_number} | Msg: {message}")
        return True, "تم الإرسال وهمياً (Mock)"

    def get_info(self) -> dict:
        return {"type": "Mock", "message": "مزود وهمي للتطوير مجاناً، لا يستهلك رصيد."}

    def send_batch(self, phones_list: list, message: str) -> dict:
        print(f"[MOCK BATCH SMS] To: {phones_list} | Msg: {message}")
        return {"status": "success", "message": "تم الإرسال وهمياً للكل"}

# =====================================================================
#   (Factory)     
# =====================================================================
def get_provider_instance(provider_name: str) -> BaseSMSProvider:
    provider_name = provider_name.lower().strip()
    if provider_name == 'wesms':
        return WeSMSProvider()
    elif provider_name == 'arpuplus':
        return ArpuPlusProvider()
    elif provider_name == 'mock':
        return MockOTPProvider()
    return WhySMSProvider()

def get_otp_provider() -> BaseSMSProvider:
    """    OTP     """
    from core.models import OperationSettings
    try:
        settings = OperationSettings.load()
        return get_provider_instance(settings.otp_provider)
    except Exception:
        return WhySMSProvider()

def get_general_sms_provider() -> BaseSMSProvider:
    """    ( )  """
    from core.models import OperationSettings
    try:
        settings = OperationSettings.load()
        return get_provider_instance(settings.general_sms_provider)
    except Exception:
        return WhySMSProvider()
