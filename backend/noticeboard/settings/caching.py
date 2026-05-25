"""Redis caching configuration for high-performance API responses."""
import os


def configure_caching(settings):
    """Configure Django caching with Redis."""
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    settings["CACHES"] = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": redis_url,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "SOCKET_CONNECT_TIMEOUT": 5,
                "SOCKET_TIMEOUT": 5,
                "RETRY_ON_TIMEOUT": True,
            },
            "KEY_PREFIX": "noticeboard",
            "TIMEOUT": 300,  # 5 minutes default
        }
    }

    # Cacheops for ORM query caching
    settings["CACHEOPS_REDIS"] = redis_url
    settings["CACHEOPS_DEFAULTS"] = {"timeout": 300}
    settings["CACHEOPS"] = {
        "auth.user": {"ops": "get", "timeout": 600},
        "users.user": {"ops": "get", "timeout": 600},
        "notices.notice": {"ops": "fetch", "timeout": 300},
        "notices.comment": {"ops": "fetch", "timeout": 120},
        "events.event": {"ops": "fetch", "timeout": 300},
        "groups.group": {"ops": "fetch", "timeout": 300},
        "campus.staffdirectory": {"ops": "fetch", "timeout": 600},
        "academic.cour": {"ops": "fetch", "timeout": 600},
        "academic.examtimetable": {"ops": "fetch", "timeout": 300},
    }
    settings["CACHEOPS_DEGRADE_ON_FAILURE"] = True
