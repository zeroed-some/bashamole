# apps/trees/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'filesystem-trees', views.FileSystemTreeViewSet)
router.register(r'directories', views.DirectoryNodeViewSet)
router.register(r'game-sessions', views.GameSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]