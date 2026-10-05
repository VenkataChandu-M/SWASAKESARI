"""
Configuration for the Sampurna Ayurvedic Flask application.
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Load environment variables from backend/.env file
load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-unsafe-flask-key')

    # Database
    DB_PATH = os.path.join('/tmp', 'sampurna.db') if os.environ.get('VERCEL') else os.path.join(BASE_DIR, 'sampurna.db')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + DB_PATH
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default-unsafe-jwt-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    # Static files (frontend)
    STATIC_FOLDER = os.path.abspath(os.path.join(BASE_DIR, '..'))

    # OTP Settings
    OTP_EXPIRY_MINUTES = 10
    OTP_LENGTH = 6

    # Firebase (for phone OTP)
    FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY', '')
    FIREBASE_AUTH_DOMAIN = os.environ.get('FIREBASE_AUTH_DOMAIN', '')
    FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', '')

    # Email SMTP (fallback OTP delivery)
    SMTP_SERVER = 'smtp.gmail.com'
    SMTP_PORT = 587
    SMTP_EMAIL = os.environ.get('SMTP_EMAIL', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

    # =========================
    # Razorpay Payment Gateway
    # =========================
    # Get from: https://dashboard.razorpay.com → Settings → API Keys
    RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID') or os.environ.get('KEY_ID', '')
    RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET') or os.environ.get('KEY_SECRET', '')

    # =========================
    # Shiprocket Delivery
    # =========================
    SHIPROCKET_EMAIL = os.environ.get('SHIPROCKET_EMAIL') or os.environ.get('shiprocket_user_gmail', '')
    SHIPROCKET_PASSWORD = os.environ.get('SHIPROCKET_PASSWORD') or os.environ.get('shiprocket_api_key', '') or os.environ.get('SHIPROCKET_API_KEY', '')
    SHIPROCKET_PICKUP_LOCATION = os.environ.get('SHIPROCKET_PICKUP_LOCATION', 'Primary')
    SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external'

    # Product defaults
    PRODUCT_NAME = 'Swasa Kesari Syrup 200ml'
    PRODUCT_PRICE = 699      # INR
    PRODUCT_WEIGHT = 0.3     # kg
    PRODUCT_LENGTH = 8       # cm
    PRODUCT_BREADTH = 8      # cm
    PRODUCT_HEIGHT = 15      # cm
    PRODUCT_HSN = '30049011' # HSN code for Ayurvedic medicines

    # COD advance booking fee
    COD_ADVANCE = 0          # INR (No advance required for Cash on Delivery)

