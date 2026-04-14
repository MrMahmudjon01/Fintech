from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MainBalanceViewSet, CategoryViewSet, TransactionViewSet,
    LoanViewSet, SavingsViewSet, GoalViewSet, NotificationViewSet,
)

router = DefaultRouter()
router.register(r'balance', MainBalanceViewSet, basename='balance')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'loans', LoanViewSet, basename='loan')
router.register(r'savings', SavingsViewSet, basename='savings')
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
