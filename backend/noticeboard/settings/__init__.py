"""
Django settings loader with automatic .env file support.

Priority order for settings:
1. Environment variables (highest priority)
2. .env file in backend/ directory
3. Default values in settings files (lowest priority)
"""

import os
import warnings

# Load .env file before importing any settings
# Go up two levels: settings/__init__.py -> noticeboard/ -> backend/
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_ENV_PATH = os.path.join(_BASE_DIR, ".env")

if os.path.exists(_ENV_PATH):
    try:
        from dotenv import load_dotenv
        load_dotenv(_ENV_PATH, override=False)  # Don't override existing env vars
    except ImportError:
        warnings.warn(
            "python-dotenv is not installed. Environment variables from .env file will not be loaded. "
            "Install with: pip install python-dotenv",
            RuntimeWarning,
        )
else:
    warnings.warn(
        f"No .env file found at {_ENV_PATH}. "
        f"Copy .env.example to .env and configure your environment. "
        f"Run: python setup_env.py",
        RuntimeWarning,
    )

# Import base settings
from .base import *

# Import environment-specific settings
env = os.environ.get("DJANGO_ENV", "local")

if env == "production":
    from .production import *
else:
    from .local import *


# Validate critical settings after all imports
def _validate_settings():
    """Validate that required settings are configured."""
    errors = []
    
    if not SECRET_KEY:
        errors.append("DJANGO_SECRET_KEY is not set. Generate one with: python setup_env.py")
    elif len(SECRET_KEY) < 32:
        errors.append(f"DJANGO_SECRET_KEY is too short ({len(SECRET_KEY)} chars). Should be at least 32 characters.")
    
    if env == "production":
        if DEBUG:
            errors.append("DJANGO_DEBUG must be False in production!")
        if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['*']:
            errors.append("DJANGO_ALLOWED_HOSTS must be explicitly set in production (not '*')!")
        if CORS_ALLOW_ALL_ORIGINS:
            errors.append("CORS_ALLOW_ALL_ORIGINS must be False in production!")
    
    if errors:
        import sys
        print("\n" + "=" * 60)
        print("  SETTINGS VALIDATION ERRORS")
        print("=" * 60)
        for error in errors:
            print(f"  - {error}")
        print("=" * 60 + "\n")
        
        if env == "production":
            raise RuntimeError("Production settings validation failed. Fix errors before starting.")


_validate_settings()
