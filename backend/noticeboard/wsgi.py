import os

# Load environment variables from .env file
# Go up one level: noticeboard/ -> backend/
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_base_dir, ".env")
if os.path.exists(_env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except ImportError:
        pass

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "noticeboard.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
