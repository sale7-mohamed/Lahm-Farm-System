import hashlib
import hmac
from decimal import Decimal
import requests
from django.conf import settings
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class PaymobService:
    def __init__(self):
        self.api_key = getattr(settings, 'PAYMOB_API_KEY', '').strip()
        self.public_key = getattr(settings, 'PAYMOB_PUBLIC_KEY', '').strip()
        self.secret_key = getattr(settings, 'PAYMOB_SECRET_KEY', '').strip()
        self.hmac_secret = getattr(settings, 'PAYMOB_HMAC_SECRET', '').strip()
        raw_ids = str(getattr(settings, 'PAYMOB_INTEGRATION_ID', '')).split(',')
        self.integration_ids =[int(i.strip()) for i in raw_ids if i.strip().isdigit()]
        self.base_url = "https://accept.paymob.com/api"

    def create_payment_link(self, amount_egp, billing_data, merchant_reference, items_description="مدفوعات لَحِم"):
        if not self.integration_ids:
            raise ValueError("لم يتم تعيين PAYMOB_INTEGRATION_ID.")

        amount_cents = int((Decimal(str(amount_egp)) * 100).quantize(Decimal('1')))
        first_name = billing_data.get("first_name", "Customer").strip() or "Customer"
        last_name = billing_data.get("last_name", "").strip()
        if not last_name or last_name == "NA":
            last_name = first_name

        payload = {
            "amount": amount_cents,
            "currency": "EGP",
            "payment_methods": self.integration_ids,
            "items": [
                {
                    "name": "طلب من متجر لَحِم",
                    "amount": amount_cents,
                    "description": items_description,
                    "quantity": 1
                }
            ],
            "billing_data": {
                "first_name": first_name,
                "last_name": last_name,
                "phone_number": billing_data.get("phone_number", "01000000000"),
                "email": billing_data.get("email", "info@lahmfarm.com"),
                "apartment": "NA",
                "street": "NA",
                "building": "NA",
                "city": "NA",
                "country": "EG",
                "floor": "NA",
                "state": "NA"
            },
            "special_reference": str(merchant_reference),
            "extras": {
                "save_card": True
            }
        }

        headers = {
            "Authorization": f"Token {self.secret_key}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post("https://accept.paymob.com/v1/intention/", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return {
                "paymob_order_id": str(data.get("intention_order_id")),
                "payment_url": f"https://accept.paymob.com/unifiedcheckout/?publicKey={self.public_key}&clientSecret={data.get('client_secret')}"
            }
        except Exception as e:
            logger.error(f"Paymob Intention API Error: {e}")
            raise e

    def get_auth_token(self):
        #   API KEY    (  )    Secret Key 
        auth_key = self.api_key if self.api_key else self.secret_key
        resp = requests.post(f"{self.base_url}/auth/tokens", json={"api_key": auth_key})
        resp.raise_for_status()
        return resp.json().get("token")

    def create_quick_link(self, amount_egp, billing_data, merchant_reference, items_description="مدفوعات لَحِم"):
        if not self.integration_ids:
            raise ValueError("لم يتم تعيين PAYMOB_INTEGRATION_ID.")

        amount_cents = int((Decimal(str(amount_egp)) * 100).quantize(Decimal('1')))
        full_name = f"{billing_data.get('first_name', '')} {billing_data.get('last_name', '')}".strip() or "Customer"

        expires_at = (datetime.now() + timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%S")
        token = self.get_auth_token()

        # Payment methods must be an array of integers for the JSON API payload
        methods_list = [int(i) for i in self.integration_ids]

        payload = {
            "amount_cents": str(amount_cents),
            "reference_id": str(merchant_reference),
            "payment_methods": methods_list,
            "email": billing_data.get("email", "info@lahmfarm.com") or "info@lahmfarm.com",
            "is_live": bool(getattr(settings, 'PAYMOB_IS_LIVE', False)),
            "full_name": full_name,
            "phone_number": billing_data.get("phone_number", "+201000000000") or "+201000000000",
            "description": items_description[:100],
            "expires_at": expires_at
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(f"{self.base_url}/ecommerce/payment-links", json=payload, headers=headers)
            if not response.ok:
                logger.error(f"Paymob QuickLink API 400 Error: {response.text}")
            response.raise_for_status()
            data = response.json()
            return {
                "paymob_order_id": str(data.get("id")),
                "payment_url": data.get("shorten_url") or data.get("client_url")
            }
        except Exception as e:
            logger.error(f"Paymob QuickLink API Error: {e}")
            raise e

    def validate_hmac(self, request_data, received_hmac):
        hmac_keys = [
            "amount_cents", "created_at", "currency", "error_occured",
            "has_parent_transaction", "id", "integration_id", "is_3d_secure",
            "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
            "is_voided", "order", "owner", "pending", "source_data.pan",
            "source_data.sub_type", "source_data.type", "success"
        ]
        obj_data = request_data.get("obj", {})
        concatenated_string = ""
        for key in hmac_keys:
            if key == "order":
                val = obj_data.get("order", {}).get("id", "")
            elif "." in key:
                parent, child = key.split(".")
                val = obj_data.get(parent, {}).get(child, "")
            else:
                val = obj_data.get(key, "")
            if isinstance(val, bool):
                val = "true" if val else "false"
            concatenated_string += str(val)
        calculated_hmac = hmac.new(
            self.hmac_secret.encode("utf-8"),
            concatenated_string.encode("utf-8"),
            hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(calculated_hmac, received_hmac)

