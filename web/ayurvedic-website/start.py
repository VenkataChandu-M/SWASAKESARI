"""
Sampurna Ayurvedic Website - Launcher Script
Installs dependencies, initializes DB, and starts the Flask server.
"""
import subprocess
import sys
import os
import webbrowser
import time

# Ensure stdout handles UTF-8 (emojis) correctly on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass


# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
REQUIREMENTS = os.path.join(BACKEND_DIR, 'requirements.txt')

def install_dependencies():
    """Install Python packages from requirements.txt."""
    print('📦 Checking dependencies...')
    try:
        subprocess.check_call(
            [sys.executable, '-m', 'pip', 'install', '-r', REQUIREMENTS, '-q'],
            stdout=subprocess.DEVNULL
        )
        print('✅ All dependencies installed!')
    except subprocess.CalledProcessError:
        print('⚠️  Some dependencies may have failed. Trying anyway...')

def start_server():
    """Start the Flask server."""
    print('\n🌿 Starting Sampurna Ayurvedic Server...')
    print('=' * 50)
    print('🌐 Website: http://localhost:8080')
    print('👤 Admin Login: admin@sampurna.com / admin123')
    print('=' * 50)
    print('\nPress Ctrl+C to stop the server.\n')

    # Open browser after a short delay
    def open_browser():
        time.sleep(2)
        webbrowser.open('http://localhost:8080')

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # Start Flask
    os.chdir(BACKEND_DIR)
    subprocess.call([sys.executable, 'app.py'])

if __name__ == '__main__':
    install_dependencies()
    start_server()
