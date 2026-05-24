from .base import *

# Try to import environment-specific settings
import os
env = os.environ.get("DJANGO_ENV", "local")

if env == "production":
    from .production import *
else:
    from .local import *
