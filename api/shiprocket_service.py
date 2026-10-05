"""
Shiprocket Delivery API Integration for Sampurna Ayurvedic.
"""
import requests
from datetime import datetime, timezone


class ShiprocketService:
    def __init__(self, email, password, api_base):
        self.email = email
        self.password = password
        self.api_base = api_base
        self.token = None
        self.token_time = None

    def is_configured(self):
        return bool(self.email and self.password)

    def check_connection(self):
        """Authenticate before allowing a customer to submit payment."""
        return self._get_token() is not None

    def _get_token(self):
        """Get or refresh JWT auth token (valid for 10 days)."""
        if self.token and self.token_time:
            elapsed = (datetime.now(timezone.utc) - self.token_time).days
            if elapsed < 9:
                return self.token

        if not self.is_configured():
            print('[SHIPROCKET] Not configured - no credentials')
            return None

        try:
            resp = requests.post(
                f'{self.api_base}/auth/login',
                json={'email': self.email, 'password': self.password},
                timeout=15
            )
            data = resp.json()
            if resp.status_code == 200 and 'token' in data:
                self.token = data['token']
                self.token_time = datetime.now(timezone.utc)
                print('[SHIPROCKET] Authenticated successfully')
                return self.token
            else:
                print(f'[SHIPROCKET] Auth failed: {data}')
                return None
        except Exception as e:
            print(f'[SHIPROCKET] Auth error: {e}')
            return None

    def _headers(self):
        token = self._get_token()
        if not token:
            return None
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }

    def create_order(self, order_data):
        """
        Create an order in Shiprocket.

        order_data should contain:
        - order_id, order_date, billing_customer_name, billing_phone,
        - billing_address, billing_city, billing_state, billing_pincode,
        - billing_email, order_items[], payment_method, sub_total,
        - weight, length, breadth, height
        """
        headers = self._headers()
        if not headers:
            return {'error': 'Shiprocket credentials are missing or authentication failed'}

        try:
            resp = requests.post(
                f'{self.api_base}/orders/create/adhoc',
                json=order_data,
                headers=headers,
                timeout=30
            )
            data = resp.json()
            if resp.status_code in [200, 201]:
                print(f'[SHIPROCKET] Order created: {data}')
                return data
            else:
                print(f'[SHIPROCKET] Order creation failed: {data}')
                return {'error': data.get('message', 'Order creation failed'), 'details': data}
        except Exception as e:
            print(f'[SHIPROCKET] Order error: {e}')
            return {'error': str(e)}

    def generate_awb(self, shipment_id, courier_id=None):
        """Assign courier and generate AWB (tracking number)."""
        headers = self._headers()
        if not headers:
            return {'error': 'Shiprocket credentials are missing or authentication failed'}

        try:
            payload = {'shipment_id': shipment_id}
            if courier_id:
                payload['courier_id'] = courier_id

            resp = requests.post(
                f'{self.api_base}/courier/assign/awb',
                json=payload,
                headers=headers,
                timeout=30
            )
            data = resp.json()
            print(f'[SHIPROCKET] AWB response: {data}')
            return data.get('response', data)
        except Exception as e:
            print(f'[SHIPROCKET] AWB error: {e}')
            return {'error': str(e)}

    def get_tracking(self, awb_code=None, order_id=None):
        """Get tracking information."""
        headers = self._headers()
        if not headers:
            return {'error': 'Shiprocket credentials are missing or authentication failed'}

        try:
            if awb_code:
                url = f'{self.api_base}/courier/track/awb/{awb_code}'
            elif order_id:
                url = f'{self.api_base}/courier/track?order_id={order_id}'
            else:
                return {'error': 'No AWB or order ID provided'}

            resp = requests.get(url, headers=headers, timeout=15)
            return resp.json()
        except Exception as e:
            print(f'[SHIPROCKET] Tracking error: {e}')
            return {'error': str(e)}

    def get_serviceability(self, pickup_pincode, delivery_pincode, weight, cod=False):
        """Check which couriers can deliver to a pincode."""
        headers = self._headers()
        if not headers:
            return {'error': 'Shiprocket credentials are missing or authentication failed'}

        try:
            params = {
                'pickup_postcode': pickup_pincode,
                'delivery_postcode': delivery_pincode,
                'weight': weight,
                'cod': 1 if cod else 0
            }
            resp = requests.get(
                f'{self.api_base}/courier/serviceability/',
                params=params,
                headers=headers,
                timeout=15
            )
            return resp.json()
        except Exception as e:
            print(f'[SHIPROCKET] Serviceability error: {e}')
            return {'error': str(e)}
