from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NoticeViewSet, NoticeTemplateViewSet, NoticeDraftViewSet
from .approval_views import NoticeApprovalViewSet

router = DefaultRouter()
router.register(r"", NoticeViewSet, basename="notices")
router.register(r"templates", NoticeTemplateViewSet, basename="notice-templates")
router.register(r"drafts", NoticeDraftViewSet, basename="notice-drafts")
router.register(r"approvals", NoticeApprovalViewSet, basename="notice-approvals")

urlpatterns = [
    path("", include(router.urls)),
]
