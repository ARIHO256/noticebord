from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GroupViewSet, GroupMessageViewSet

router = DefaultRouter()
router.register(r"", GroupViewSet, basename="groups")
router.register(r"messages", GroupMessageViewSet, basename="group-messages")

urlpatterns = [
    path("", include(router.urls)),
]
