from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import uuid

from .models import MainBalance, Transaction, Savings, Goal, Loan, Notification
from .validators import (
    validate_positive_amount,
    validate_sufficient_balance,
    validate_savings_withdrawal,
    validate_savings_goal_allocation,
    validate_loan_repayment,
)


class BalanceService:
    """Service for MainBalance operations."""

    @staticmethod
    def get_or_create(user):
        """Get or create the user's main balance."""
        balance, created = MainBalance.objects.get_or_create(user=user)
        return balance

    @staticmethod
    @transaction.atomic
    def add_income(user, amount, category=None, note=None, date=None):
        """Record income to main balance."""
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)

        balance.total_amount += amount
        balance.save(update_fields=['total_amount', 'updated_at'])

        tx = Transaction.objects.create(
            user=user,
            type='INCOME',
            amount=amount,
            source_type='EXTERNAL',
            destination_type='MAIN',
            category=category,
            note=note,
            date=date or timezone.now().date(),
        )
        return tx

    @staticmethod
    @transaction.atomic
    def record_expense(user, amount, category=None, note=None, date=None):
        """Record expense from main balance."""
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)

        balance.total_amount -= amount
        balance.save(update_fields=['total_amount', 'updated_at'])

        tx = Transaction.objects.create(
            user=user,
            type='EXPENSE',
            amount=amount,
            source_type='MAIN',
            destination_type='EXTERNAL',
            category=category,
            note=note,
            date=date or timezone.now().date(),
        )

        # Check for expense spike
        NotificationService.check_expense_spike(user, amount)

        return tx


class SavingsService:
    """Service for Savings operations."""

    @staticmethod
    @transaction.atomic
    def deposit(user, savings_id, amount, note=None, date=None):
        """
        Transfer money from main balance to savings.
        Creates paired transaction records.
        """
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)
        savings = Savings.objects.select_for_update().get(id=savings_id, user=user)

        # Deduct from main balance
        balance.total_amount -= amount
        balance.save(update_fields=['total_amount', 'updated_at'])

        # Add to savings
        savings.current_amount += amount
        if savings.target_amount and savings.current_amount >= savings.target_amount:
            savings.status = 'COMPLETED'
        savings.save(update_fields=['current_amount', 'status', 'updated_at'])

        group_id = uuid.uuid4()
        date_val = date or timezone.now().date()

        # Transaction: Main → Savings
        tx = Transaction.objects.create(
            user=user,
            type='SAVINGS_DEPOSIT',
            amount=amount,
            source_type='MAIN',
            destination_type='SAVINGS',
            destination_id=savings.id,
            transaction_group_id=group_id,
            note=note or f"Jamg'armaga o'tkazma: {savings.name}",
            date=date_val,
        )
        return tx

    @staticmethod
    @transaction.atomic
    def withdraw(user, savings_id, amount, note=None, date=None):
        """
        Transfer money from savings to main balance.
        Validates minimum_limit.
        """
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)
        savings = Savings.objects.select_for_update().get(id=savings_id, user=user)

        validate_savings_withdrawal(savings, amount)

        # Deduct from savings
        savings.current_amount -= amount
        savings.save(update_fields=['current_amount', 'updated_at'])

        # Add to main balance
        balance.total_amount += amount
        balance.save(update_fields=['total_amount', 'updated_at'])

        group_id = uuid.uuid4()
        date_val = date or timezone.now().date()

        tx = Transaction.objects.create(
            user=user,
            type='SAVINGS_WITHDRAW',
            amount=amount,
            source_type='SAVINGS',
            source_id=savings.id,
            destination_type='MAIN',
            transaction_group_id=group_id,
            note=note or f"Jamg'armadan yechish: {savings.name}",
            date=date_val,
        )

        # Check minimum limit after withdrawal
        NotificationService.check_savings_minimum(user, savings)

        return tx

    @staticmethod
    @transaction.atomic
    def allocate_to_goal(user, savings_id, goal_id, amount, note=None):
        """Move funds from savings to a goal. Validates minimum_limit first."""
        amount = validate_positive_amount(amount)
        savings = Savings.objects.select_for_update().get(id=savings_id, user=user)
        goal = Goal.objects.select_for_update().get(id=goal_id, savings=savings)

        validate_savings_goal_allocation(savings)
        validate_savings_withdrawal(savings, amount)

        savings.current_amount -= amount
        savings.save(update_fields=['current_amount', 'updated_at'])

        goal.current_amount += amount
        if goal.current_amount >= goal.target_amount:
            goal.status = 'COMPLETED'
        goal.save(update_fields=['current_amount', 'status'])

        group_id = uuid.uuid4()

        tx = Transaction.objects.create(
            user=user,
            type='TRANSFER',
            amount=amount,
            source_type='SAVINGS',
            source_id=savings.id,
            destination_type='SAVINGS',
            destination_id=goal.id,
            transaction_group_id=group_id,
            note=note or f"Maqsadga ajratma: {goal.name}",
            date=timezone.now().date(),
        )

        NotificationService.check_savings_minimum(user, savings)
        return tx


class LoanService:
    """Service for Loan operations."""

    @staticmethod
    @transaction.atomic
    def create_loan(user, person_name, amount, direction, destination='MAIN',
                    destination_savings_id=None, due_date=None, date=None, note=None):
        """
        Create a new loan and route money to the chosen destination.
        INCOMING: we receive money → add to balance or savings
        OUTGOING: we give money → deduct from balance
        """
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)

        dest_savings = None
        if destination == 'SAVINGS' and destination_savings_id:
            dest_savings = Savings.objects.get(id=destination_savings_id, user=user)

        loan = Loan.objects.create(
            user=user,
            person_name=person_name,
            amount=amount,
            direction=direction,
            destination=destination,
            destination_savings=dest_savings,
            due_date=due_date,
            date=date or timezone.now().date(),
            note=note,
        )

        date_val = date or timezone.now().date()
        group_id = uuid.uuid4()

        if direction == 'INCOMING':
            # We receive money
            if destination == 'SAVINGS' and dest_savings:
                dest_savings.current_amount += amount
                dest_savings.save(update_fields=['current_amount', 'updated_at'])

                Transaction.objects.create(
                    user=user,
                    type='LOAN_IN',
                    amount=amount,
                    source_type='LOAN',
                    source_id=loan.id,
                    destination_type='SAVINGS',
                    destination_id=dest_savings.id,
                    transaction_group_id=group_id,
                    note=note or f"Qarz olindi: {person_name} → Jamg'arma",
                    date=date_val,
                )
            else:
                balance.total_amount += amount
                balance.save(update_fields=['total_amount', 'updated_at'])

                Transaction.objects.create(
                    user=user,
                    type='LOAN_IN',
                    amount=amount,
                    source_type='LOAN',
                    source_id=loan.id,
                    destination_type='MAIN',
                    transaction_group_id=group_id,
                    note=note or f"Qarz olindi: {person_name} → Asosiy balans",
                    date=date_val,
                )

        elif direction == 'OUTGOING':
            # We give money — deduct from main balance
            balance.total_amount -= amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user,
                type='LOAN_OUT',
                amount=amount,
                source_type='MAIN',
                destination_type='LOAN',
                destination_id=loan.id,
                transaction_group_id=group_id,
                note=note or f"Qarz berildi: {person_name}",
                date=date_val,
            )

        return loan

    @staticmethod
    @transaction.atomic
    def record_repayment(user, loan_id, amount, note=None, date=None):
        """
        Record a loan repayment.
        INCOMING loan repayment: we pay back → deduct from balance
        OUTGOING loan repayment: they pay back → add to balance
        """
        amount = validate_positive_amount(amount)
        loan = Loan.objects.select_for_update().get(id=loan_id, user=user)
        balance = BalanceService.get_or_create(user)

        validate_loan_repayment(loan, amount)

        loan.amount_paid += amount
        if loan.amount_paid >= loan.amount:
            loan.status = 'SETTLED'
        loan.save(update_fields=['amount_paid', 'status', 'updated_at'])

        date_val = date or timezone.now().date()

        if loan.direction == 'INCOMING':
            # We pay back — deduct from balance
            balance.total_amount -= amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user,
                type='LOAN_REPAY',
                amount=amount,
                source_type='MAIN',
                destination_type='LOAN',
                destination_id=loan.id,
                note=note or f"Qarz to'lovi: {loan.person_name}",
                date=date_val,
            )
        else:
            # They pay back — add to balance
            balance.total_amount += amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user,
                type='LOAN_REPAY',
                amount=amount,
                source_type='LOAN',
                source_id=loan.id,
                destination_type='MAIN',
                note=note or f"Qarz qaytarish: {loan.person_name}",
                date=date_val,
            )

        return loan


class TransferService:
    """Service for generic transfers between accounts."""

    @staticmethod
    @transaction.atomic
    def transfer(user, from_type, to_type, amount, from_id=None, to_id=None, note=None, date=None):
        """
        Universal transfer handler.
        Supports: MAIN↔SAVINGS, SAVINGS↔SAVINGS
        """
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)
        group_id = uuid.uuid4()
        date_val = date or timezone.now().date()

        # Deduct from source
        if from_type == 'MAIN':
            balance.total_amount -= amount
            balance.save(update_fields=['total_amount', 'updated_at'])
        elif from_type == 'SAVINGS':
            savings_from = Savings.objects.select_for_update().get(id=from_id, user=user)
            validate_savings_withdrawal(savings_from, amount)
            savings_from.current_amount -= amount
            savings_from.save(update_fields=['current_amount', 'updated_at'])

        # Add to destination
        if to_type == 'MAIN':
            balance.total_amount += amount
            balance.save(update_fields=['total_amount', 'updated_at'])
        elif to_type == 'SAVINGS':
            savings_to = Savings.objects.select_for_update().get(id=to_id, user=user)
            savings_to.current_amount += amount
            savings_to.save(update_fields=['current_amount', 'updated_at'])

        tx = Transaction.objects.create(
            user=user,
            type='TRANSFER',
            amount=amount,
            source_type=from_type,
            source_id=from_id,
            destination_type=to_type,
            destination_id=to_id,
            transaction_group_id=group_id,
            note=note or f"O'tkazma: {from_type} → {to_type}",
            date=date_val,
        )
        return tx


class NotificationService:
    """Service for creating notifications."""

    @staticmethod
    def create(user, title, message, notification_type='INFO',
               related_type=None, related_id=None):
        """Create a notification and optionally send via Telegram."""
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            type=notification_type,
            related_object_type=related_type,
            related_object_id=related_id,
        )
        # Try to send via Telegram
        try:
            from apps.telegram.services import TelegramService
            TelegramService.send_notification(user, notification)
        except Exception:
            pass  # Telegram not configured or unavailable

        return notification

    @staticmethod
    def check_savings_minimum(user, savings):
        """Create notification if savings drops below minimum_limit."""
        if savings.is_below_minimum:
            NotificationService.create(
                user=user,
                title=f"⚠️ Jamg'arma chegaradan past: {savings.name}",
                message=(
                    f"{savings.name} jamg'arma balansi ({savings.current_amount:,.0f} so'm) "
                    f"minimal chegaradan ({savings.minimum_limit:,.0f} so'm) pastga tushdi."
                ),
                notification_type='SAVINGS_LOW',
                related_type='savings',
                related_id=savings.id,
            )

    @staticmethod
    def check_expense_spike(user, amount):
        """Check if this expense is unusually high compared to average."""
        from django.db.models import Avg
        from datetime import timedelta

        avg_expense = Transaction.objects.filter(
            user=user,
            type='EXPENSE',
            date__gte=timezone.now().date() - timedelta(days=30),
        ).aggregate(avg=Avg('amount'))['avg']

        if avg_expense and amount > Decimal(str(avg_expense)) * 3:
            NotificationService.create(
                user=user,
                title="🔴 Katta xarajat aniqlandi!",
                message=(
                    f"{amount:,.0f} so'm xarajat qayd etildi. "
                    f"Bu oxirgi 30 kunlik o'rtacha ({avg_expense:,.0f} so'm) dan 3 baravar ko'p."
                ),
                notification_type='EXPENSE_SPIKE',
            )

    @staticmethod
    def check_loan_due_dates(user):
        """Check for loans due within 3 days."""
        from datetime import timedelta
        threshold = timezone.now().date() + timedelta(days=3)

        due_soon = Loan.objects.filter(
            user=user,
            status='ACTIVE',
            due_date__isnull=False,
            due_date__lte=threshold,
        )

        for loan in due_soon:
            # Avoid duplicate notifications
            existing = Notification.objects.filter(
                user=user,
                type='LOAN_DUE',
                related_object_type='loan',
                related_object_id=loan.id,
                created_at__date=timezone.now().date(),
            ).exists()

            if not existing:
                NotificationService.create(
                    user=user,
                    title=f"⏰ Qarz muddati yaqinlashmoqda: {loan.person_name}",
                    message=(
                        f"{loan.person_name}ga {loan.remaining_amount:,.0f} so'm "
                        f"qarz {loan.due_date} sanagacha to'lanishi kerak."
                    ),
                    notification_type='LOAN_DUE',
                    related_type='loan',
                    related_id=loan.id,
                )
