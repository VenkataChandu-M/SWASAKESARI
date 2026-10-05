"""
Database models for Sampurna Ayurvedic application.
"""
from datetime import datetime, timezone, timedelta
from flask_sqlalchemy import SQLAlchemy
import bcrypt

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(200), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    orders = db.relationship('Order', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'is_admin': self.is_admin,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Product info
    product_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    unit_price = db.Column(db.Float, default=699.0)
    total_price = db.Column(db.Float, nullable=False)

    # Order status
    status = db.Column(db.String(50), default='pending')
    # pending → confirmed → shipped → delivered / cancelled

    # Shipping address
    shipping_name = db.Column(db.String(150), nullable=True)
    shipping_phone = db.Column(db.String(20), nullable=True)
    shipping_email = db.Column(db.String(150), nullable=True)
    shipping_address = db.Column(db.String(500), nullable=True)
    shipping_city = db.Column(db.String(100), nullable=True)
    shipping_state = db.Column(db.String(100), nullable=True)
    shipping_pincode = db.Column(db.String(10), nullable=True)

    # Payment info
    payment_method = db.Column(db.String(20), default='online')  # 'online' or 'cod'
    payment_status = db.Column(db.String(20), default='pending')  # 'pending', 'paid', 'failed'
    advance_paid = db.Column(db.Float, default=0)  # For COD: ₹100 advance
    razorpay_order_id = db.Column(db.String(100), nullable=True)
    razorpay_payment_id = db.Column(db.String(100), nullable=True)

    # Shiprocket delivery
    shiprocket_order_id = db.Column(db.String(50), nullable=True)
    shiprocket_shipment_id = db.Column(db.String(50), nullable=True)
    shiprocket_awb = db.Column(db.String(50), nullable=True)
    courier_name = db.Column(db.String(100), nullable=True)
    tracking_url = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'user_email': self.user.email if self.user else None,
            'product_name': self.product_name,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'total_price': self.total_price,
            'status': self.status,
            'shipping_name': self.shipping_name,
            'shipping_phone': self.shipping_phone,
            'shipping_address': self.shipping_address,
            'shipping_city': self.shipping_city,
            'shipping_state': self.shipping_state,
            'shipping_pincode': self.shipping_pincode,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status,
            'advance_paid': self.advance_paid,
            'razorpay_order_id': self.razorpay_order_id,
            'razorpay_payment_id': self.razorpay_payment_id,
            'shiprocket_order_id': self.shiprocket_order_id,
            'shiprocket_awb': self.shiprocket_awb,
            'courier_name': self.courier_name,
            'tracking_url': self.tracking_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Contact(db.Model):
    __tablename__ = 'contacts'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    interest = db.Column(db.String(100), nullable=True)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'interest': self.interest,
            'message': self.message,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class OTP(db.Model):
    __tablename__ = 'otps'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), nullable=False)
    otp_code = db.Column(db.String(10), nullable=False)
    purpose = db.Column(db.String(30), nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, nullable=False)

    @staticmethod
    def generate(email, purpose, expiry_minutes=10):
        import random
        code = str(random.randint(100000, 999999))
        otp = OTP(
            email=email.lower(),
            otp_code=code,
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        )
        OTP.query.filter_by(
            email=email.lower(), purpose=purpose, is_used=False
        ).update({'is_used': True})
        db.session.add(otp)
        db.session.commit()
        return code

    @staticmethod
    def verify(email, code, purpose):
        otp = OTP.query.filter_by(
            email=email.lower(),
            otp_code=code,
            purpose=purpose,
            is_used=False
        ).first()

        if not otp:
            return False

        if datetime.now(timezone.utc) > otp.expires_at.replace(tzinfo=timezone.utc):
            return False

        otp.is_used = True
        db.session.commit()
        return True
