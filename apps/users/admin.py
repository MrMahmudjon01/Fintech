from django.contrib import admin
from .models import User, PendingUser

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'full_name', 'email', 'is_verified', 'is_active', 'created_at')
    list_filter = ('is_verified', 'is_active', 'is_staff')
    search_fields = ('phone_number', 'full_name', 'email')
    ordering = ('-created_at',)


@admin.register(PendingUser)
class PendingUserAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'full_name', 'verification_code', 'expires_at', 'created_at')
    search_fields = ('phone_number', 'full_name')
    ordering = ('-created_at',)
