#!/usr/bin/env python3
"""
Setup script to generate a secure .env file for the Bugema NoticeBoard backend.

Usage:
    python setup_env.py          # Interactive mode
    python setup_env.py --auto   # Auto-generate with secure defaults
"""

import argparse
import os
import secrets
import sys


def generate_secret_key():
    """Generate a cryptographically secure Django secret key."""
    return secrets.token_urlsafe(50)


def generate_password(length=16):
    """Generate a random password."""
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def create_env_file(auto=False, env_type="local"):
    """Create a .env file with secure defaults."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    
    if os.path.exists(env_path) and not auto:
        response = input(f"\n.env file already exists at {env_path}\nOverwrite? (y/N): ")
        if response.lower() not in ('y', 'yes'):
            print("Aborted. Existing .env kept.")
            return
    
    secret_key = generate_secret_key()
    db_password = generate_password(20)
    
    if env_type == "production":
        config = f"""# =============================================================================
# Bugema University NoticeBoard - PRODUCTION Environment
# =============================================================================
# Generated automatically by setup_env.py
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# =============================================================================

DJANGO_SECRET_KEY={secret_key}
DJANGO_ENV=production
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=api.bugema.ac.ug,bugema.ac.ug

# PostgreSQL (Production)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=bugema_noticeboard
DB_USER=bugema
DB_PASSWORD={db_password}
DB_HOST=db
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=https://bugema.ac.ug,https://www.bugema.ac.ug

# Email (SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_HOST_USER=noreply@bugema.ac.ug
EMAIL_HOST_PASSWORD=your-email-password-here
DEFAULT_FROM_EMAIL=Bugema University <noreply@bugema.ac.ug>

# Redis & Celery
REDIS_URL=redis://redis:6379/1
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
USE_REDIS_CACHE=1

# Security
SECURE_SSL_REDIRECT=1
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=1
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1

# Logging
LOG_LEVEL=INFO
"""
    else:
        config = f"""# =============================================================================
# Bugema University NoticeBoard - LOCAL Development Environment
# =============================================================================
# Generated automatically by setup_env.py
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# =============================================================================

DJANGO_SECRET_KEY={secret_key}
DJANGO_ENV=local
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,*,0.0.0.0

# SQLite (Local Development)
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3

# CORS (Allow all for local development)
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19000,http://localhost:3000

# Email (Console backend for local dev)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Bugema University <noreply@bugema.ac.ug>

# Redis & Celery
REDIS_URL=redis://localhost:6379/1
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
USE_REDIS_CACHE=0

# Logging
LOG_LEVEL=DEBUG
"""
    
    with open(env_path, 'w') as f:
        f.write(config)
    
    print(f"\n{'='*60}")
    print(f"  .env file created at: {env_path}")
    print(f"  Environment type: {env_type.upper()}")
    print(f"{'='*60}")
    
    if env_type == "production":
        print(f"\n  IMPORTANT: Update these values before deploying:")
        print(f"    - DJANGO_ALLOWED_HOSTS")
        print(f"    - DB_PASSWORD (currently auto-generated)")
        print(f"    - EMAIL_HOST_USER and EMAIL_HOST_PASSWORD")
        print(f"    - CORS_ALLOWED_ORIGINS")
    
    print(f"\n  Secret Key: {secret_key[:20]}...")
    print(f"  Keep this file secure and never commit it!")
    print(f"{'='*60}\n")


def validate_env():
    """Validate that the .env file has all required values."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    
    if not os.path.exists(env_path):
        print(f"ERROR: No .env file found at {env_path}")
        print("Run: python setup_env.py")
        return False
    
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        print("WARNING: python-dotenv not installed. Install with: pip install python-dotenv")
        return False
    
    required_vars = [
        ("DJANGO_SECRET_KEY", "Must be a long random string"),
        ("DJANGO_ENV", "Should be 'local' or 'production'"),
    ]
    
    warnings = []
    errors = []
    
    for var, description in required_vars:
        value = os.environ.get(var)
        if not value:
            errors.append(f"  MISSING: {var} - {description}")
        elif var == "DJANGO_SECRET_KEY" and len(value) < 32:
            warnings.append(f"  WEAK: {var} should be at least 32 characters (currently {len(value)})")
    
    env_type = os.environ.get("DJANGO_ENV", "local")
    
    if env_type == "production":
        prod_vars = [
            ("DJANGO_DEBUG", "Must be 0 in production"),
            ("DB_PASSWORD", "Database password required"),
            ("EMAIL_HOST_PASSWORD", "Email password required"),
        ]
        for var, description in prod_vars:
            value = os.environ.get(var)
            if not value:
                errors.append(f"  MISSING: {var} - {description}")
            elif var == "DJANGO_DEBUG" and value == "1":
                errors.append(f"  DANGER: DJANGO_DEBUG=1 in production!")
    
    print(f"\n{'='*60}")
    print(f"  Environment Validation ({env_type.upper()})")
    print(f"{'='*60}")
    
    if errors:
        print(f"\n  ERRORS:")
        for e in errors:
            print(e)
    
    if warnings:
        print(f"\n  WARNINGS:")
        for w in warnings:
            print(w)
    
    if not errors and not warnings:
        print(f"\n  All checks passed!")
    
    print(f"{'='*60}\n")
    return len(errors) == 0


def main():
    parser = argparse.ArgumentParser(
        description="Setup and validate .env file for Bugema NoticeBoard"
    )
    parser.add_argument(
        "--auto", action="store_true", help="Auto-generate without prompts"
    )
    parser.add_argument(
        "--production", action="store_true", help="Generate production config"
    )
    parser.add_argument(
        "--validate", action="store_true", help="Validate existing .env file"
    )
    
    args = parser.parse_args()
    
    if args.validate:
        success = validate_env()
        sys.exit(0 if success else 1)
    
    env_type = "production" if args.production else "local"
    create_env_file(auto=args.auto, env_type=env_type)
    validate_env()


if __name__ == "__main__":
    main()
