"""
Initialize the database and create the default admin account.
Run this script once to set up the database.
"""
import sys
import os

# Add parent directory so we can import from backend
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from flask import Flask
from models import db, User

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    # Create all tables
    db.create_all()
    print('✅ Database tables created successfully!')

    # Create default admin if none exists
    if not User.query.filter_by(is_admin=True).first():
        admin = User(
            name='Admin',
            email='admin@sampurna.com',
            phone='9010547855',
            is_admin=True
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print('✅ Default admin account created:')
        print('   Email: admin@sampurna.com')
        print('   Password: admin123')
    else:
        print('ℹ️  Admin account already exists.')

    print(f'\n📁 Database location: {Config.SQLALCHEMY_DATABASE_URI}')
    print('🎉 Database initialization complete!')
