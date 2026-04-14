from django.urls import path
from .views import (
    RegisterStartView,
    RegisterVerifyView,
    RegisterConfirmView,
    LoginView,
    LogoutView,
    UserProfileView,
    ChangePasswordView,
    ChangePhoneView,
    ForgotPasswordStartView,
    ForgotPasswordConfirmView
)

urlpatterns = [
    path('register/start/', RegisterStartView.as_view(), name='register_start'),
    path('register/verify/', RegisterVerifyView.as_view(), name='register_verify'),
    path('register/confirm/', RegisterConfirmView.as_view(), name='register_confirm'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('profile/password/', ChangePasswordView.as_view(), name='change_password'),
    path('profile/phone/', ChangePhoneView.as_view(), name='change_phone'),
    path('password/reset/start/', ForgotPasswordStartView.as_view(), name='reset_password_start'),
    path('password/reset/confirm/', ForgotPasswordConfirmView.as_view(), name='reset_password_confirm'),
]
