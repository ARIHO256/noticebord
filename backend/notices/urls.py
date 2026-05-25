from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NoticeViewSet, NoticeTemplateViewSet, NoticeDraftViewSet

router = DefaultRouter()
router.register(r"", NoticeViewSet, basename="notices")
router.register(r"templates", NoticeTemplateViewSet, basename="notice-templates")
router.register(r"drafts", NoticeDraftViewSet, basename="notice-drafts")

urlpatterns = [
    path("", include(router.urls)),
]
