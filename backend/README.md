# Bugema University NoticeBoard - Backend

## Architecture

This is a production-grade Django REST API powering the Bugema University NoticeBoard mobile application.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Django 5.x + Django REST Framework |
| Authentication | JWT (SimpleJWT) |
| Database | PostgreSQL (production) / SQLite (local dev) |
| Cache / Broker | Redis |
| Async Tasks | Celery + Celery Beat |
| Real-Time | Django Channels + WebSockets |
| Search | PostgreSQL Full-Text Search |
| Container | Docker + Docker Compose |

### Apps

| App | Purpose |
|-----|---------|
| `users` | Custom User model, auth, friendships, device tokens, appeals |
| `notices` | Notices, comments, likes, favorites, reports, attachments, templates, reminders |
| `messaging` | Direct messaging between users (conversations & messages) |
| `moderation` | Content moderation (text checks, violation tracking) |
| `notifications` | Unified in-app notification system with WebSocket delivery |
| `audit` | Immutable audit logs, GDPR data export/deletion |
| `common` | Shared base models (SoftDeleteModel, TimestampModel) |

### Key Features Implemented

- **JWT Authentication** with email/username login
- **Email Verification** on registration
- **Password Reset** via email
- **Rate Limiting** on sensitive endpoints (login, register, messaging, etc.)
- **Content Moderation** with text profanity/threat/harassment detection
- **Real-Time Notifications** via WebSockets
- **Real-Time Messaging** via WebSockets with typing indicators
- **Push Notifications** via Expo (async with Celery)
- **Audit Logging** for all admin actions
- **GDPR Compliance** with data export and deletion requests
- **File Upload Security** with type and size validation
- **Full-Text Search** for notices
- **Soft Deletes** on all models
- **Health Check** endpoints (`/health/`, `/ready/`)

### Environment Variables

See `.env.example` for all required variables.

### Running Locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set environment variables
export DJANGO_SECRET_KEY=your-secret-key
export DJANGO_ENV=local

python manage.py migrate
python manage.py runserver
```

### Running with Docker

```bash
docker-compose up --build
```

### Running Tests

```bash
python manage.py test users.tests notices.tests notifications.tests audit.tests
```

### API Documentation

Swagger UI available at `/api/docs/`
OpenAPI schema at `/api/schema/`

### WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| `ws/notifications/` | Real-time notifications |
| `ws/conversations/<id>/` | Real-time messaging |

### Celery Tasks

| Task | Schedule |
|------|----------|
| `send_push_notification` | On-demand (async) |
| `send_email_notification` | On-demand (async) |
| `generate_data_export` | On-demand (async) |
| `cleanup_old_notifications` | Daily (via beat) |
| `cleanup_expired_exports` | Daily (via beat) |
