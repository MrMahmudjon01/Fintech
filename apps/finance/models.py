from django.db import models
from django.conf import settings
from django.utils import timezone
from .managers import SoftDeleteManager, AllObjectsManager
import uuid


class SoftDeleteModel(models.Model):
    """Abstract base model providing soft-delete functionality."""
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """Soft delete instead of hard delete."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def hard_delete(self, using=None, keep_parents=False):
        """Actually remove from database."""
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])


# ─────────────────────────────────────────────────────────
# MAIN BALANCE
# ─────────────────────────────────────────────────────────
class MainBalance(models.Model):
    """
    Central balance for a user. Single record per user.
    Receives money from: income, savings withdrawal, loans.
    Sends money to: expenses, savings deposits.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='main_balance_account'
    )
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    # Weekly tracking
    weekly_start_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    week_start_date = models.DateField(default=timezone.now)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Main Balance'
        verbose_name_plural = 'Main Balances'

    def __str__(self):
        return f"{self.user.phone_number} — Balance: {self.total_amount}"

    def reset_weekly_tracking(self):
        """Snapshot current balance as start of new week."""
        self.weekly_start_amount = self.total_amount
        self.week_start_date = timezone.now().date()
        self.save(update_fields=['weekly_start_amount', 'week_start_date'])


# ─────────────────────────────────────────────────────────
# CATEGORY
# ─────────────────────────────────────────────────────────
class Category(SoftDeleteModel):
    TYPE_CHOICES = (
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='categories'
    )
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='EXPENSE')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Categories'
        unique_together = ('user', 'name')

    def __str__(self):
        return f"{self.name} ({self.type})"


# ─────────────────────────────────────────────────────────
# SAVINGS (JAMG'ARMA)
# ─────────────────────────────────────────────────────────
class Savings(SoftDeleteModel):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('FROZEN', 'Frozen'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='savings'
    )
    name = models.CharField(max_length=255)
    current_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    target_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    minimum_limit = models.DecimalField(
        max_digits=15, decimal_places=2, default=0.00,
        help_text="If balance drops below this, goal allocations are blocked."
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Savings'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} — {self.current_amount}"

    @property
    def is_below_minimum(self):
        return self.current_amount < self.minimum_limit

    @property
    def progress_percent(self):
        if self.target_amount and self.target_amount > 0:
            return min(100, round((self.current_amount / self.target_amount) * 100))
        return 0


# ─────────────────────────────────────────────────────────
# GOAL (sub-entity of Savings)
# ─────────────────────────────────────────────────────────
class Goal(SoftDeleteModel):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
    )

    savings = models.ForeignKey(Savings, on_delete=models.CASCADE, related_name='goals')
    name = models.CharField(max_length=255)
    target_amount = models.DecimalField(max_digits=15, decimal_places=2)
    current_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.current_amount}/{self.target_amount})"


# ─────────────────────────────────────────────────────────
# LOAN (QARZ) — replaces old Debt model
# ─────────────────────────────────────────────────────────
class Loan(SoftDeleteModel):
    DIRECTION_CHOICES = (
        ('INCOMING', 'Incoming (Qarz oldim)'),
        ('OUTGOING', 'Outgoing (Qarz berdim)'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('SETTLED', "Settled (To'landi)"),
    )
    DESTINATION_CHOICES = (
        ('MAIN', 'Main Balance'),
        ('SAVINGS', 'Savings Account'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='loans'
    )
    person_name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    due_date = models.DateField(null=True, blank=True)
    date = models.DateField(default=timezone.now)
    note = models.TextField(blank=True, null=True)

    # Where does the loan money go/come from?
    destination = models.CharField(
        max_length=20, choices=DESTINATION_CHOICES, default='MAIN',
        help_text="When loan is taken, where to route the money."
    )
    destination_savings = models.ForeignKey(
        Savings, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='linked_loans',
        help_text="If destination is SAVINGS, which savings account."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.person_name} — {self.direction} — {self.amount}"

    @property
    def remaining_amount(self):
        return max(0, self.amount - self.amount_paid)

    @property
    def repayment_percent(self):
        if self.amount > 0:
            return min(100, round((self.amount_paid / self.amount) * 100))
        return 0


# ─────────────────────────────────────────────────────────
# TRANSACTION (UNIVERSAL LEDGER)
# ─────────────────────────────────────────────────────────
class Transaction(SoftDeleteModel):
    """
    Universal transaction table.
    Every money movement MUST create a Transaction record.
    Transfers create paired records linked by transaction_group_id.
    """
    TRANSACTION_TYPES = (
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
        ('TRANSFER', 'Transfer'),
        ('LOAN_IN', 'Loan Received'),
        ('LOAN_OUT', 'Loan Given'),
        ('LOAN_REPAY', 'Loan Repayment'),
        ('SAVING', 'Saving'),
        ('SAVINGS_DEPOSIT', 'Savings Deposit'),
        ('SAVINGS_WITHDRAW', 'Savings Withdrawal'),
    )

    ACCOUNT_TYPES = (
        ('MAIN', 'Main Balance'),
        ('SAVINGS', 'Savings Account'),
        ('LOAN', 'Loan'),
        ('EXTERNAL', 'External'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='transactions'
    )

    # Universal type
    type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)

    # Source account
    source_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default='MAIN')
    source_id = models.IntegerField(null=True, blank=True)

    # Destination account
    destination_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default='EXTERNAL')
    destination_id = models.IntegerField(null=True, blank=True)

    # Transfer linkage
    transaction_group_id = models.UUIDField(null=True, blank=True, db_index=True)

    amount = models.DecimalField(max_digits=15, decimal_places=2)
    note = models.TextField(blank=True, null=True)
    date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['source_type', 'source_id']),
            models.Index(fields=['destination_type', 'destination_id']),
            models.Index(fields=['type']),
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.type} — {self.amount} — {self.date}"


# ─────────────────────────────────────────────────────────
# NOTIFICATION
# ─────────────────────────────────────────────────────────
class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('INFO', 'Info'),
        ('SAVINGS_LOW', 'Savings Below Minimum'),
        ('LOAN_DUE', 'Loan Due Soon'),
        ('EXPENSE_SPIKE', 'Expense Spike'),
        ('WEEKLY_SUMMARY', 'Weekly Summary'),
        ('MONTHLY_SUMMARY', 'Monthly Summary'),
        ('REMINDER', 'Reminder'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='INFO')

    # Link to related object
    related_object_type = models.CharField(max_length=50, null=True, blank=True)
    related_object_id = models.IntegerField(null=True, blank=True)

    # Telegram delivery tracking
    is_sent_telegram = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title}"
