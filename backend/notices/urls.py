from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NoticeTemplateViewSet, NoticeViewSet


router = DefaultRouter()
router.include_format_suffixes = False
router.register(r"", NoticeViewSet, basename="notice")
router.register(r"templates", NoticeTemplateViewSet, basename="notice-template")


urlpatterns = [
    path("", include(router.urls)),
]
