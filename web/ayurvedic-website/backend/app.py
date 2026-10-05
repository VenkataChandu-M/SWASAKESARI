"""
Sampurna Ayurvedic - Flask Backend Application (Phase 3)
REST API for auth, checkout, payments (Razorpay), delivery (Shiprocket).
"""
import os
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from config import Config
from models import db, User, Order, Contact, OTP
from razorpay_service import RazorpayService
from shiprocket_service import ShiprocketService

app = Flask(__name__, static_folder=Config.STATIC_FOLDER)
app.config.from_object(Config)

CORS(app)
jwt = JWTManager(app)

BLOCKLIST = set()

# Initialize payment & delivery services
razorpay_svc = RazorpayService(Config.RAZORPAY_KEY_ID, Config.RAZORPAY_KEY_SECRET)
shiprocket_svc = ShiprocketService(Config.SHIPROCKET_EMAIL, Config.SHIPROCKET_PASSWORD, Config.SHIPROCKET_API_BASE)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    return jwt_payload['jti'] in BLOCKLIST


# ==========================================
# Static File Serving
# ==========================================

@app.route('/')
def serve_index():
    return send_from_directory(Config.STATIC_FOLDER, 'index.html')


@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(Config.STATIC_FOLDER, 'dashboard.html')


@app.route('/admin')
def serve_admin():
    return send_from_directory(Config.STATIC_FOLDER, 'admin.html')


@app.route('/<path:filename>')
def serve_static(filename):
    file_path = os.path.join(Config.STATIC_FOLDER, filename)
    if os.path.isfile(file_path):
        directory = os.path.dirname(file_path)
        basename = os.path.basename(file_path)
        return send_from_directory(directory, basename)
    return jsonify({'error': 'Not found'}), 404


# ==========================================
# Auth API
# ==========================================

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists'}), 409

    user = User(name=name, email=email, phone=phone, is_verified=True)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'is_admin': user.is_admin}
    )

    return jsonify({
        'message': 'Account created successfully!',
        'token': token,
        'user': user.to_dict(),
        'requires_verification': False
    }), 201



@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'is_admin': user.is_admin}
    )

    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    jti = get_jwt()['jti']
    BLOCKLIST.add(jti)
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200


# ==========================================
# OTP / Verification API
# ==========================================

@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    """Send or resend OTP for email verification."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'No account found with this email'}), 404

    if user.is_verified:
        return jsonify({'message': 'Email already verified'}), 200

    otp_code = OTP.generate(email, 'verify_email', Config.OTP_EXPIRY_MINUTES)
    send_otp_email(email, otp_code, 'verify_email', {
        'SMTP_EMAIL': Config.SMTP_EMAIL,
        'SMTP_PASSWORD': Config.SMTP_PASSWORD,
        'SMTP_SERVER': Config.SMTP_SERVER,
        'SMTP_PORT': Config.SMTP_PORT,
    })

    return jsonify({'message': 'Verification code sent to your email'}), 200


@app.route('/api/auth/verify-email', methods=['POST'])
def verify_email():
    """Verify email with OTP code."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    otp_code = data.get('otp', '').strip()

    if not email or not otp_code:
        return jsonify({'error': 'Email and OTP code are required'}), 400

    if not OTP.verify(email, otp_code, 'verify_email'):
        return jsonify({'error': 'Invalid or expired code. Please try again.'}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        user.is_verified = True
        db.session.commit()

    return jsonify({'message': 'Email verified successfully!', 'user': user.to_dict()}), 200


@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Send password reset OTP."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Don't reveal if email exists for security
        return jsonify({'message': 'If an account exists, a reset code has been sent'}), 200

    otp_code = OTP.generate(email, 'reset_password', Config.OTP_EXPIRY_MINUTES)
    send_otp_email(email, otp_code, 'reset_password', {
        'SMTP_EMAIL': Config.SMTP_EMAIL,
        'SMTP_PASSWORD': Config.SMTP_PASSWORD,
        'SMTP_SERVER': Config.SMTP_SERVER,
        'SMTP_PORT': Config.SMTP_PORT,
    })

    return jsonify({'message': 'If an account exists, a reset code has been sent'}), 200


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password using OTP."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    otp_code = data.get('otp', '').strip()
    new_password = data.get('new_password', '')

    if not email or not otp_code or not new_password:
        return jsonify({'error': 'Email, OTP, and new password are required'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if not OTP.verify(email, otp_code, 'reset_password'):
        return jsonify({'error': 'Invalid or expired code'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.set_password(new_password)
    db.session.commit()

    return jsonify({'message': 'Password reset successfully! You can now login.'}), 200


@app.route('/api/auth/verify-firebase', methods=['POST'])
@jwt_required()
def verify_via_firebase():
    """Mark user as verified after Firebase phone OTP verification."""
    user_id = get_jwt_identity()
    data = request.get_json()
    phone = data.get('phone', '').strip()

    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.is_verified = True
    if phone:
        user.phone = phone
    db.session.commit()

    return jsonify({'message': 'Phone verified successfully!', 'user': user.to_dict()}), 200


# ==========================================
# User Profile API
# ==========================================

@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    order_count = Order.query.filter_by(user_id=user.id).count()
    total_spent = db.session.query(db.func.sum(Order.total_price)).filter_by(user_id=user.id).scalar() or 0

    return jsonify({
        'user': user.to_dict(),
        'stats': {
            'total_orders': order_count,
            'total_spent': total_spent
        }
    }), 200


@app.route('/api/user/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    if data.get('name'):
        user.name = data['name'].strip()
    if data.get('phone'):
        user.phone = data['phone'].strip()

    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': user.to_dict()}), 200


# ==========================================
# Checkout & Payment API
# ==========================================

@app.route('/api/checkout', methods=['POST'])
@jwt_required()
def checkout():
    """Create an order (COD or Online)."""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Validate required fields
    required = ['quantity', 'payment_method', 'shipping_name', 'shipping_phone',
                'shipping_address', 'shipping_city', 'shipping_state', 'shipping_pincode']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field.replace("_", " ").title()} is required'}), 400

    quantity = int(data['quantity'])
    if quantity < 1 or quantity > 10:
        return jsonify({'error': 'Quantity must be between 1 and 10'}), 400

    payment_method = data['payment_method']  # 'online' or 'cod'
    if payment_method not in ('online', 'cod'):
        return jsonify({'error': 'Payment method must be online or cod'}), 400

    unit_price = Config.PRODUCT_PRICE
    total_price = unit_price * quantity

    if payment_method == 'cod':
        # Cash on Delivery: Direct confirmation without Razorpay advance
        order = Order(
            user_id=int(user_id),
            product_name=Config.PRODUCT_NAME,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            status='confirmed',
            payment_method='cod',
            payment_status='pending',
            advance_paid=0,
            shipping_name=data['shipping_name'].strip(),
            shipping_phone=data['shipping_phone'].strip(),
            shipping_email=user.email,
            shipping_address=data['shipping_address'].strip(),
            shipping_city=data['shipping_city'].strip(),
            shipping_state=data['shipping_state'].strip(),
            shipping_pincode=data['shipping_pincode'].strip()
        )
        db.session.add(order)
        db.session.commit()

        # Try booking Shiprocket if configured
        shiprocket_result = None
        if shiprocket_svc.is_configured():
            shiprocket_result = _book_shiprocket(order)

        return jsonify({
            'message': 'Order placed successfully with Cash on Delivery!',
            'order_id': order.id,
            'is_cod': True,
            'total_price': total_price,
            'payment_method': 'cod',
            'order': order.to_dict(),
            'shiprocket': shiprocket_result
        }), 201

    # Online Payment: Requires Razorpay setup
    if not razorpay_svc.is_configured():
        return jsonify({'error': 'Razorpay is not configured on the server'}), 503

    payment_amount = total_price

    # Create order in DB
    order = Order(
        user_id=int(user_id),
        product_name=Config.PRODUCT_NAME,
        quantity=quantity,
        unit_price=unit_price,
        total_price=total_price,
        status='pending',
        payment_method='online',
        payment_status='pending',
        advance_paid=0,
        shipping_name=data['shipping_name'].strip(),
        shipping_phone=data['shipping_phone'].strip(),
        shipping_email=user.email,
        shipping_address=data['shipping_address'].strip(),
        shipping_city=data['shipping_city'].strip(),
        shipping_state=data['shipping_state'].strip(),
        shipping_pincode=data['shipping_pincode'].strip()
    )
    db.session.add(order)
    db.session.commit()

    # Create Razorpay payment order
    try:
        rz_order = razorpay_svc.create_order(
            amount_inr=payment_amount,
            receipt=f'order_{order.id}',
            notes={
                'order_id': str(order.id),
                'product': Config.PRODUCT_NAME,
                'qty': str(quantity),
                'payment_type': payment_method
            }
        )
    except Exception:
        app.logger.exception('Razorpay order creation failed')
        order.payment_status = 'failed'
        order.status = 'cancelled'
        db.session.commit()
        return jsonify({'error': 'Could not start payment. Please try again later.'}), 502

    order.razorpay_order_id = rz_order.get('id', '')
    db.session.commit()

    return jsonify({
        'message': 'Order created! Complete payment.',
        'order_id': order.id,
        'razorpay_order_id': rz_order.get('id', ''),
        'razorpay_key': Config.RAZORPAY_KEY_ID,
        'amount': int(payment_amount * 100),  # paise
        'amount_display': payment_amount,
        'total_price': total_price,
        'payment_method': payment_method,
        'currency': 'INR',
        'prefill': {
            'name': order.shipping_name,
            'email': user.email,
            'contact': order.shipping_phone
        }
    }), 201


@app.route('/api/payment/verify', methods=['POST'])
@jwt_required()
def verify_payment():
    """Verify Razorpay payment and book Shiprocket delivery."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    order_id = data.get('order_id')
    razorpay_order_id = data.get('razorpay_order_id', '')
    razorpay_payment_id = data.get('razorpay_payment_id', '')
    razorpay_signature = data.get('razorpay_signature', '')

    if not all((order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature)):
        return jsonify({'error': 'Order ID and Razorpay payment details are required'}), 400

    try:
        order = Order.query.get(int(order_id))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid order ID'}), 400
    if not order or str(order.user_id) != str(user_id):
        return jsonify({'error': 'Order not found'}), 404
    if order.razorpay_order_id != razorpay_order_id:
        return jsonify({'error': 'Payment does not match this order'}), 400

    if order.payment_status == 'paid':
        if order.razorpay_payment_id != razorpay_payment_id:
            return jsonify({'error': 'Order has already been paid'}), 409
        shiprocket_result = _book_shiprocket(order) if shiprocket_svc.is_configured() else None
        return jsonify({
            'message': 'Payment already verified.',
            'order': order.to_dict(),
            'shiprocket': shiprocket_result
        }), 200
    if order.payment_status != 'pending':
        return jsonify({'error': 'Order is not awaiting payment'}), 409

    # Verify Razorpay payment signature
    is_valid = razorpay_svc.verify_payment(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    )

    if not is_valid:
        return jsonify({'error': 'Payment verification failed'}), 400

    # Payment successful
    order.razorpay_payment_id = razorpay_payment_id
    order.payment_status = 'paid'
    order.status = 'paid'
    order.advance_paid = order.total_price
    db.session.commit()

    # Book Shiprocket delivery if configured
    shiprocket_result = _book_shiprocket(order) if shiprocket_svc.is_configured() else None

    return jsonify({
        'message': 'Payment successful! Order confirmed.',
        'order': order.to_dict(),
        'shiprocket': shiprocket_result
    }), 200



def _book_shiprocket(order):
    """Internal: Create order in Shiprocket and assign courier."""
    if not order.shiprocket_order_id:
        now = datetime.now(timezone.utc)
        order_data = {
            'order_id': f'SA-{order.id}',
            'order_date': now.strftime('%Y-%m-%d %H:%M'),
            'pickup_location': Config.SHIPROCKET_PICKUP_LOCATION,
            'channel_id': '',
            'comment': f'Sampurna Ayurvedic Order #{order.id}',
            'billing_customer_name': order.shipping_name,
            'billing_last_name': '',
            'billing_address': order.shipping_address,
            'billing_address_2': '',
            'billing_city': order.shipping_city,
            'billing_pincode': order.shipping_pincode,
            'billing_state': order.shipping_state,
            'billing_country': 'India',
            'billing_email': order.shipping_email or '',
            'billing_phone': order.shipping_phone,
            'shipping_is_billing': True,
            'order_items': [
                {
                    'name': order.product_name,
                    'sku': 'SWASA-KESARI-200ML',
                    'units': order.quantity,
                    'selling_price': order.unit_price,
                    'discount': 0,
                    'tax': 0,
                    'hsn': Config.PRODUCT_HSN
                }
            ],
            'payment_method': 'COD' if order.payment_method == 'cod' else 'Prepaid',
            'shipping_charges': 0,
            'giftwrap_charges': 0,
            'transaction_charges': 0,
            'total_discount': 0,
            'sub_total': order.total_price,
            'length': Config.PRODUCT_LENGTH,
            'breadth': Config.PRODUCT_BREADTH,
            'height': Config.PRODUCT_HEIGHT,
            'weight': Config.PRODUCT_WEIGHT * order.quantity
        }

        result = shiprocket_svc.create_order(order_data)
        if not result or result.get('error'):
            return result or {'error': 'Shiprocket did not return an order'}
        if not result.get('order_id') or not result.get('shipment_id'):
            return {'error': 'Shiprocket response is missing order or shipment ID'}

        order.shiprocket_order_id = str(result['order_id'])
        order.shiprocket_shipment_id = str(result['shipment_id'])
        db.session.commit()

    if not order.shiprocket_shipment_id:
        return {'error': 'Shiprocket shipment ID is missing'}

    if not order.shiprocket_awb:
        awb_result = shiprocket_svc.generate_awb(order.shiprocket_shipment_id)
        if not awb_result or awb_result.get('error'):
            return awb_result or {'error': 'Shiprocket did not return an AWB'}

        awb_data = awb_result.get('data', awb_result)
        if not awb_data.get('awb_code'):
            return {'error': 'Shiprocket did not assign an AWB', 'details': awb_result}
        order.shiprocket_awb = str(awb_data['awb_code'])
        order.courier_name = str(awb_data.get('courier_name', ''))

    order.status = 'confirmed'
    db.session.commit()
    return {
        'order_id': order.shiprocket_order_id,
        'shipment_id': order.shiprocket_shipment_id,
        'awb_code': order.shiprocket_awb,
        'courier_name': order.courier_name
    }


# ==========================================
# Orders API
# ==========================================

@app.route('/api/orders', methods=['GET'])
@jwt_required()
def get_user_orders():
    user_id = get_jwt_identity()
    orders = Order.query.filter_by(user_id=int(user_id)).order_by(
        Order.created_at.desc()
    ).all()
    return jsonify({'orders': [o.to_dict() for o in orders]}), 200


@app.route('/api/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order_detail(order_id):
    user_id = get_jwt_identity()
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if str(order.user_id) != str(user_id):
        return jsonify({'error': 'Access denied'}), 403
    return jsonify({'order': order.to_dict()}), 200


@app.route('/api/orders/<int:order_id>/track', methods=['GET'])
@jwt_required()
def track_order(order_id):
    """Get live tracking for an order from Shiprocket."""
    user_id = get_jwt_identity()
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if str(order.user_id) != str(user_id):
        return jsonify({'error': 'Access denied'}), 403

    tracking = None
    if order.shiprocket_awb:
        tracking = shiprocket_svc.get_tracking(awb_code=order.shiprocket_awb)
    elif order.shiprocket_order_id:
        tracking = shiprocket_svc.get_tracking(order_id=f'SA-{order.id}')

    return jsonify({
        'order': order.to_dict(),
        'tracking': tracking
    }), 200


@app.route('/api/razorpay-config', methods=['GET'])
def razorpay_config():
    """Return Razorpay key for frontend."""
    return jsonify({
        'key_id': Config.RAZORPAY_KEY_ID,
        'product_name': Config.PRODUCT_NAME,
        'product_price': Config.PRODUCT_PRICE,
        'cod_advance': Config.COD_ADVANCE
    }), 200


# ==========================================
# Contact API
# ==========================================

@app.route('/api/contact', methods=['POST'])
def submit_contact():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    interest = data.get('interest', '').strip()
    message = data.get('message', '').strip()

    if not name or not email or not message:
        return jsonify({'error': 'Name, email, and message are required'}), 400

    contact = Contact(name=name, email=email, interest=interest, message=message)
    db.session.add(contact)
    db.session.commit()

    return jsonify({'message': 'Message sent successfully! We will get back to you soon.'}), 201


# ==========================================
# Admin API
# ==========================================

def admin_required(fn):
    from functools import wraps

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if not claims.get('is_admin', False):
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    total_users = User.query.filter_by(is_admin=False).count()
    verified_users = User.query.filter_by(is_admin=False, is_verified=True).count()
    total_orders = Order.query.count()
    total_contacts = Contact.query.count()
    unread_contacts = Contact.query.filter_by(is_read=False).count()
    pending_orders = Order.query.filter_by(status='pending').count()

    from sqlalchemy import func
    total_revenue = db.session.query(func.sum(Order.total_price)).scalar() or 0

    return jsonify({
        'total_users': total_users,
        'verified_users': verified_users,
        'total_orders': total_orders,
        'total_contacts': total_contacts,
        'unread_contacts': unread_contacts,
        'pending_orders': pending_orders,
        'total_revenue': total_revenue
    }), 200


@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def admin_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify({'orders': [o.to_dict() for o in orders]}), 200


@app.route('/api/admin/orders/<int:order_id>/shiprocket', methods=['POST'])
@admin_required
def retry_shiprocket_order(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order.payment_status != 'paid':
        return jsonify({'error': 'Only paid orders can be booked with Shiprocket'}), 409

    result = _book_shiprocket(order)
    if not result or result.get('error'):
        return jsonify({'error': 'Shiprocket booking failed', 'shiprocket': result}), 502
    return jsonify({'order': order.to_dict(), 'shiprocket': result}), 200


@app.route('/api/admin/orders/<int:order_id>', methods=['PUT'])
@admin_required
def update_order_status(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    data = request.get_json()
    new_status = data.get('status')
    if new_status:
        order.status = new_status
        db.session.commit()
    return jsonify({'message': 'Order updated', 'order': order.to_dict()}), 200


@app.route('/api/admin/contacts', methods=['GET'])
@admin_required
def admin_contacts():
    contacts = Contact.query.order_by(Contact.created_at.desc()).all()
    return jsonify({'contacts': [c.to_dict() for c in contacts]}), 200


@app.route('/api/admin/contacts/<int:contact_id>/read', methods=['PUT'])
@admin_required
def mark_contact_read(contact_id):
    contact = Contact.query.get(contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404
    contact.is_read = True
    db.session.commit()
    return jsonify({'message': 'Marked as read'}), 200


@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_users():
    users = User.query.filter_by(is_admin=False).order_by(User.created_at.desc()).all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200


# ==========================================
# Firebase Config Endpoint
# ==========================================

@app.route('/api/firebase-config', methods=['GET'])
def firebase_config():
    """Return Firebase config for frontend initialization."""
    return jsonify({
        'apiKey': Config.FIREBASE_API_KEY,
        'authDomain': Config.FIREBASE_AUTH_DOMAIN,
        'projectId': Config.FIREBASE_PROJECT_ID
    }), 200


# ==========================================
# Initialize and Run
# ==========================================

with app.app_context():
    db.init_app(app)
    db.create_all()

    # Create default admin if none exists
    if not User.query.filter_by(is_admin=True).first():
        admin = User(
            name='Admin',
            email='admin@sampurna.com',
            phone='9010547855',
            is_admin=True,
            is_verified=True
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print('[OK] Default admin created: admin@sampurna.com / admin123')


if __name__ == '__main__':
    print('')
    print('[*] Sampurna Ayurvedic Server Starting...')
    print('[>] Website:   http://localhost:8080')
    print('[>] Dashboard: http://localhost:8080/dashboard')
    print('[>] Admin:     http://localhost:8080/admin')
    print('[>] Admin login: admin@sampurna.com / admin123')
    print('')
    app.run(host='0.0.0.0', port=8080, debug=True)
