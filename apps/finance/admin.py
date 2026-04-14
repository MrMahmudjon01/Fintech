from django.contrib import admin
from .models import MainBalance, Category, Savings, Goal, Loan, Transaction, Notification


@admin.register(MainBalance)
class MainBalanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_amount', 'weekly_start_amount', 'week_start_date', 'updated_at')
    search_fields = ('user__phone_number', 'user__full_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'user', 'is_deleted', 'created_at')
    search_fields = ('name', 'user__phone_number')
    list_filter = ('type', 'is_deleted', 'created_at')


@admin.register(Savings)
class SavingsAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'current_amount', 'target_amount', 'minimum_limit', 'status', 'is_deleted')
    search_fields = ('name', 'user__phone_number')
    list_filter = ('status', 'is_deleted', 'created_at')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('name', 'savings', 'current_amount', 'target_amount', 'status', 'is_deleted')
    list_filter = ('status', 'is_deleted')


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ('person_name', 'user', 'direction', 'amount', 'amount_paid', 'status', 'due_date', 'destination', 'is_deleted')
    search_fields = ('person_name', 'user__phone_number')
    list_filter = ('direction', 'status', 'destination', 'is_deleted', 'created_at')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'amount', 'source_type', 'destination_type', 'category', 'date', 'is_deleted')
    search_fields = ('user__phone_number', 'note')
    list_filter = ('type', 'source_type', 'destination_type', 'is_deleted', 'date')
    readonly_fields = ('created_at', 'transaction_group_id')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'type', 'is_read', 'is_sent_telegram', 'created_at')
    search_fields = ('title', 'user__phone_number')
    list_filter = ('type', 'is_read', 'is_sent_telegram', 'created_at')
