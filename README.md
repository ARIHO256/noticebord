# Bugema University Online NoticeBoard

A world-class noticeboard application for Bugema University, built with Django REST API and React Native (Expo).

## Quick Start (New Setup)

The fastest way to get started is using the setup script:

```bash
# Clone the repository
git clone <your-repo-url>
cd Bugema_Online_NoticeBoard

# Run the setup script (interactive)
./setup.sh

# Or auto-generate with defaults
./setup.sh --auto

# Or for production
./setup.sh --auto --production
```

The setup script will:
1. Create a Python virtual environment for the backend
2. Generate secure `.env` files for both backend and mobile
3. Install `python-dotenv` for environment loading
4. Show you the next steps

---

## Manual Setup

### 1. Backend Environment

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate .env file
python setup_env.py --auto

# Or interactive mode
python setup_env.py

# Run migrations
python manage.py migrate

# Start server
python manage.py runserver
```

### 2. Mobile Environment

```bash
cd mobile

# Generate .env file
node setup_env.js --auto

# Or detect your local IP automatically
node setup_env.js --ip

# Install dependencies
npm install

# Start Expo
npx expo start
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DJANGO_SECRET_KEY` | **Yes** | 50+ character random string for cryptographic signing |
| `DJANGO_ENV` | Yes | `local` or `production` |
| `DJANGO_DEBUG` | Yes | `1` for local, `0` for production |
| `DJANGO_ALLOWED_HOSTS` | Yes | Comma-separated allowed hostnames |
| `DB_ENGINE` | Yes | `django.db.backends.sqlite3` or `django.db.backends.postgresql` |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | For PostgreSQL | Database username |
| `DB_PASSWORD` | For PostgreSQL | Database password |
| `DB_HOST` | For PostgreSQL | Database host |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated frontend URLs |
| `EMAIL_BACKEND` | Yes | `django.core.mail.backends.console.EmailBackend` for local |
| `EMAIL_HOST_USER` | For SMTP | Email address |
| `EMAIL_HOST_PASSWORD` | For SMTP | Email password |
| `REDIS_URL` | For async | Redis connection URL |
| `CELERY_BROKER_URL` | For async | Celery broker URL |

**Generate a new secret key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Mobile (`mobile/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | **Yes** | Backend API URL |
| `EXPO_PUBLIC_API_PORT` | No | API port fallback |
| `EXPO_PUBLIC_DEBUG` | No | Enable debug logging |

**Finding your API URL:**
- iOS Simulator: `http://localhost:8000`
- Android Emulator: `http://10.0.2.2:8000`
- Physical Device: `http://YOUR_COMPUTER_IP:8000`

**Get your computer's IP:**
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or use the setup script
node mobile/setup_env.js --ip
```

---

## Project Structure

```
├── backend/          # Django REST API
│   ├── .env          # Backend secrets (gitignored)
│   ├── .env.example  # Template for backend .env
│   ├── setup_env.py  # Backend .env generator
│   └── ...
├── mobile/           # React Native (Expo) app
│   ├── .env          # Mobile config (gitignored)
│   ├── .env.example  # Template for mobile .env
│   ├── setup_env.js  # Mobile .env generator
│   └── ...
├── docker-compose.yml
├── Dockerfile
└── setup.sh          # Master setup script
```

---

## Docker (Production)

```bash
# Copy and configure production .env
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Start all services
docker-compose up --build
```

Services:
- `db` - PostgreSQL database
- `redis` - Redis cache and message broker
- `backend` - Django ASGI server (Daphne)
- `celery` - Background task worker
- `celery-beat` - Scheduled task scheduler

---

## Backend Features

### Core
- JWT Authentication (email + username login)
- Email verification on registration
- Password reset via email
- Role-based access control (Student, Faculty, Staff, Admin)
- User suspension/unsuspension with appeals

### Notices
- CRUD notices with attachments (images, videos, audio, documents)
- Categories: Campus Life, Business, Education, General
- Priority levels: Urgent, Important, Normal
- Pinned notices, scheduling, expiration
- Comments with nested replies
- Likes, favorites, view tracking
- Reporting system
- Notice templates
- Reminders
- Full-text search

### Social
- Friend requests (send/accept/decline)
- Friendship management
- Direct messaging (1-on-1 conversations)
- Department following/unfollowing

### Real-Time
- WebSocket notifications (new notices, comments, likes, messages)
- WebSocket messaging with typing indicators and read receipts

### Notifications
- Unified in-app notification feed
- Push notifications via Expo
- Email notifications for important events
- Per-user notification preferences

### Security
- Rate limiting on all sensitive endpoints
- Content moderation (text profanity/threat/harassment detection)
- File upload validation (type + size)
- CORS restrictions in production
- Security headers (HSTS, XSS protection, etc.)

### Compliance
- Audit logging for all admin actions
- GDPR data export
- GDPR data deletion requests

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/token/` - Obtain JWT
- `POST /api/v1/auth/token/refresh/` - Refresh JWT
- `POST /api/v1/auth/password-reset/` - Request password reset

### Users
- `GET/POST /api/v1/users/profiles/` - User CRUD
- `GET /api/v1/users/profiles/me/` - Current user
- `POST /api/v1/users/profiles/{id}/suspend/` - Suspend user
- `POST /api/v1/users/profiles/{id}/unsuspend/` - Unsuspend user
- `GET /api/v1/users/verify-email/?token=` - Verify email

### Notices
- `GET/POST /api/v1/notices/` - Notice CRUD
- `GET /api/v1/notices/search/?q=` - Full-text search
- `GET /api/v1/notices/analytics/` - Analytics dashboard
- `POST /api/v1/notices/{id}/like/` - Like notice
- `POST /api/v1/notices/{id}/comments/` - Add comment

### Notifications
- `GET /api/v1/notifications/` - List notifications
- `GET /api/v1/notifications/unread-count/` - Unread count
- `POST /api/v1/notifications/mark-read/` - Mark as read

### Audit/GDPR
- `GET /api/v1/audit/logs/` - Audit logs (admin)
- `POST /api/v1/audit/data-export/` - Request data export
- `POST /api/v1/audit/data-delete/` - Request data deletion

### Health
- `GET /health/` - Health check
- `GET /ready/` - Readiness check

---

## WebSocket Endpoints

- `ws://host/ws/notifications/` - Real-time notifications
- `ws://host/ws/conversations/{id}/` - Real-time messaging

---

## Testing

```bash
cd backend
python manage.py test users.tests notices.tests notifications.tests audit.tests
```

---

## License

This project is built for Bugema University.
