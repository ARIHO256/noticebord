import os

# Load environment variables from .env file before Celery setup
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_base_dir, ".env")
if os.path.exists(_env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except ImportError:
        pass

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "noticeboard.settings")

from celery import Celery
from celery.signals import beat_init

app = Celery("noticeboard")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")


@beat_init.connect
def on_beat_init(sender, **kwargs):
    print("Celery beat initialized")
