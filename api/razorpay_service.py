"""
Razorpay Payment Gateway Integration for Sampurna Ayurvedic.
"""
import razorpay


class RazorpayService:
    def __init__(self, key_id, key_secret):
        self.key_id = key_id
        self.key_secret = key_secret
        self.client = None
        if key_id and key_secret:
            self.client = razorpay.Client(auth=(key_id, key_secret))

    def is_configured(self):
        return self.client is not None

    def create_order(self, amount_inr, receipt, notes=None):
        """
        Create a Razorpay order.
        amount_inr: amount in INR (will be converted to paise)
        receipt: unique receipt ID (e.g., 'order_5')
        """
        if not self.is_configured():
            raise RuntimeError('Razorpay is not configured')

        order_data = {
            'amount': int(amount_inr * 100),  # Convert to paise
            'currency': 'INR',
            'receipt': str(receipt),
            'payment_capture': 1  # Auto capture
        }
        if notes:
            order_data['notes'] = notes

        order = self.client.order.create(data=order_data)
        print(f'[RAZORPAY] Order created: {order["id"]} for Rs.{amount_inr}')
        return order

    def verify_payment(self, razorpay_order_id, razorpay_payment_id, razorpay_signature):
        """
        Verify payment signature from Razorpay.
        Returns True if signature is valid.
        """
        if not self.is_configured():
            print('[RAZORPAY] Not configured - refusing payment verification')
            return False

        try:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            self.client.utility.verify_payment_signature(params_dict)
            print(f'[RAZORPAY] Payment verified: {razorpay_payment_id}')
            return True
        except razorpay.errors.SignatureVerificationError:
            print(f'[RAZORPAY] Signature verification FAILED for {razorpay_payment_id}')
            return False
        except Exception as e:
            print(f'[RAZORPAY] Verification error: {e}')
            return False
