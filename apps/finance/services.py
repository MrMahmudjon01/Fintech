from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import uuid

from django.core.exceptions import ValidationError

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

        validate_sufficient_balance(balance, amount)

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

        NotificationService.check_expense_spike(user, amount)

        # Generic transaction Delete/Update uses generic fallback so don't be too restrictive
        return tx

    @staticmethod
    @transaction.atomic
    def adjust_balance_for_transaction_update(user, tx, new_type, new_amount, new_category=None, new_note=None, new_date=None):
        """Update transaction and apply diff to balance correctly."""
        new_amount = validate_positive_amount(new_amount)
        balance = BalanceService.get_or_create(user)
        
        old_amount = tx.amount
        old_type = tx.type

        # Revert old effect (Basic generic fallback)
        if old_type in ['INCOME', 'SAVINGS_WITHDRAW', 'LOAN_IN', 'LOAN_REPAY_OUT']: # Things that added money to main balance
            validate_sufficient_balance(balance, old_amount)
            balance.total_amount -= old_amount
        elif old_type in ['EXPENSE', 'SAVINGS_DEPOSIT', 'LOAN_OUT', 'LOAN_REPAY', 'TRANSFER']: # Things that took money
            balance.total_amount += old_amount

        # Apply new effect
        if new_type in ['INCOME', 'SAVINGS_WITHDRAW', 'LOAN_IN', 'LOAN_REPAY_OUT']:
            balance.total_amount += new_amount
        elif new_type in ['EXPENSE', 'SAVINGS_DEPOSIT', 'LOAN_OUT', 'LOAN_REPAY', 'TRANSFER']:
            validate_sufficient_balance(balance, new_amount)
            balance.total_amount -= new_amount

        balance.save(update_fields=['total_amount', 'updated_at'])

        # Revert relational old effect
        if old_type == 'SAVINGS_DEPOSIT' and tx.destination_id:
            savings = Savings.objects.filter(id=tx.destination_id).first()
            if savings:
                savings.current_amount -= old_amount
                savings.save(update_fields=['current_amount'])
        elif old_type == 'SAVINGS_WITHDRAW' and tx.source_id:
            savings = Savings.objects.filter(id=tx.source_id).first()
            if savings:
                savings.current_amount += old_amount
                savings.save(update_fields=['current_amount'])
        elif old_type == 'LOAN_REPAY':
            loan_id = tx.destination_id if tx.source_type == 'MAIN' else tx.source_id
            if loan_id:
                loan = Loan.objects.filter(id=loan_id).first()
                if loan:
                    loan.amount_paid -= old_amount
                    if loan.amount_paid < loan.amount: loan.status = 'ACTIVE'
                    loan.save()
        elif old_type in ['LOAN_IN', 'LOAN_OUT']:
            loan_id = tx.source_id if old_type == 'LOAN_IN' else tx.destination_id
            if loan_id:
                loan = Loan.objects.filter(id=loan_id).first()
                if loan:
                    # Adjust loan initial amount backward 
                    loan.amount -= old_amount
                    loan.save()

        # Apply relational new effect
        if new_type == 'SAVINGS_DEPOSIT' and tx.destination_id:
            savings = Savings.objects.filter(id=tx.destination_id).first()
            if savings:
                savings.current_amount += new_amount
                savings.save(update_fields=['current_amount'])
        elif new_type == 'SAVINGS_WITHDRAW' and tx.source_id:
            savings = Savings.objects.filter(id=tx.source_id).first()
            if savings:
                if savings.current_amount < new_amount:
                   raise ValidationError("Jamg'armada yetarli mablag' yo'q.")
                savings.current_amount -= new_amount
                savings.save(update_fields=['current_amount'])
        elif new_type == 'LOAN_REPAY':
            loan_id = tx.destination_id if tx.source_type == 'MAIN' else tx.source_id
            if loan_id:
                loan = Loan.objects.filter(id=loan_id).first()
                if loan:
                    loan.amount_paid += new_amount
                    if loan.amount_paid >= loan.amount: loan.status = 'SETTLED'
                    loan.save()
        elif new_type in ['LOAN_IN', 'LOAN_OUT']:
            loan_id = tx.source_id if new_type == 'LOAN_IN' else tx.destination_id
            if loan_id:
                loan = Loan.objects.filter(id=loan_id).first()
                if loan:
                    loan.amount += new_amount
                    loan.save()

        tx.type = new_type
        tx.amount = new_amount
        tx.category = new_category
        if new_note is not None:
             tx.note = new_note
        if new_date is not None:
             tx.date = new_date
        
        if new_type == 'INCOME':
            tx.source_type = 'EXTERNAL'
            tx.destination_type = 'MAIN'
            tx.source_id = None
            tx.destination_id = None
        elif new_type == 'EXPENSE':
            tx.source_type = 'MAIN'
            tx.destination_type = 'EXTERNAL'
            tx.source_id = None
            tx.destination_id = None

        tx.save()
        return tx

    @staticmethod
    @transaction.atomic
    def adjust_balance_for_transaction_delete(user, tx):
        """Revert transaction effect and delete."""
        balance = BalanceService.get_or_create(user)
        
        if tx.type in ['INCOME', 'SAVINGS_WITHDRAW', 'LOAN_IN', 'LOAN_REPAY_OUT']:
            validate_sufficient_balance(balance, tx.amount)
            balance.total_amount -= tx.amount
        elif tx.type in ['EXPENSE', 'SAVINGS_DEPOSIT', 'LOAN_OUT', 'LOAN_REPAY', 'TRANSFER']:
            balance.total_amount += tx.amount
        
        balance.save(update_fields=['total_amount', 'updated_at'])

        # Revert relational old effect
        if tx.type == 'SAVINGS_DEPOSIT' and tx.destination_id:
            savings = Savings.objects.filter(id=tx.destination_id).first()
            if savings:
                savings.current_amount -= tx.amount
                savings.save(update_fields=['current_amount'])
        elif tx.type == 'SAVINGS_WITHDRAW' and tx.source_id:
            savings = Savings.objects.filter(id=tx.source_id).first()
            if savings:
                savings.current_amount += tx.amount
                savings.save(update_fields=['current_amount'])
        elif tx.type == 'LOAN_REPAY':
            loan_id = tx.destination_id if tx.source_type == 'MAIN' else tx.source_id
            if loan_id:
                loan = Loan.objects.filter(id=loan_id).first()
                if loan:
                    loan.amount_paid -= tx.amount
                    if loan.amount_paid < loan.amount: loan.status = 'ACTIVE'
                    loan.save()
        elif tx.type in ['LOAN_IN', 'LOAN_OUT']:
            loan_id = tx.source_id if tx.type == 'LOAN_IN' else tx.destination_id
            if loan_id:
                Loan.objects.filter(id=loan_id).delete()

        tx.delete()


class SavingsService:
    """Service for Savings operations."""

    @staticmethod
    @transaction.atomic
    def deposit(user, savings_id, amount, note=None, date=None):
        """
        Transfer money from main balance to savings.
        """
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)
        validate_sufficient_balance(balance, amount)

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

        NotificationService.check_savings_minimum(user, savings)
        return tx

    @staticmethod
    @transaction.atomic
    def allocate_to_goal(user, savings_id, goal_id, amount, note=None):
        """Move funds from savings to a goal."""
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

    @staticmethod
    @transaction.atomic
    def withdraw_from_goal(user, goal_id, amount, note=None):
        """Move funds from a goal back to savings pool."""
        amount = validate_positive_amount(amount)
        goal = Goal.objects.select_for_update().get(id=goal_id, savings__user=user)
        savings = goal.savings

        if goal.current_amount < amount:
            raise ValidationError("Maqsadda yetarli mablag' yo'q")

        goal.current_amount -= amount
        if goal.current_amount < goal.target_amount:
            goal.status = 'ACTIVE'
        goal.save(update_fields=['current_amount', 'status'])

        savings.current_amount += amount
        savings.save(update_fields=['current_amount', 'updated_at'])

        group_id = uuid.uuid4()

        tx = Transaction.objects.create(
            user=user,
            type='TRANSFER',
            amount=amount,
            source_type='SAVINGS',
            source_id=goal.id,
            destination_type='SAVINGS',
            destination_id=savings.id,
            transaction_group_id=group_id,
            note=note or f"Maqsaddan qaytarildi: {goal.name}",
            date=timezone.now().date(),
        )
        return tx


class LoanService:
    @staticmethod
    @transaction.atomic
    def create_loan(user, person_name, amount, direction, due_date=None, date=None, note=None):
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)

        if direction == 'OUTGOING':
            validate_sufficient_balance(balance, amount)

        loan = Loan.objects.create(
            user=user, person_name=person_name, amount=amount,
            direction=direction, due_date=due_date, date=date or timezone.now().date(), note=note,
        )

        date_val = date or timezone.now().date()
        group_id = uuid.uuid4()

        if direction == 'INCOMING':
            balance.total_amount += amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user, type='LOAN_IN', amount=amount, source_type='LOAN', source_id=loan.id,
                destination_type='MAIN', transaction_group_id=group_id,
                note=note or f"Qarz olindi: {person_name}", date=date_val,
            )

        elif direction == 'OUTGOING':
            balance.total_amount -= amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user, type='LOAN_OUT', amount=amount, source_type='MAIN',
                destination_type='LOAN', destination_id=loan.id,
                transaction_group_id=group_id, note=note or f"Qarz berildi: {person_name}", date=date_val,
            )

        return loan

    @staticmethod
    @transaction.atomic
    def update_loan(user, loan_id, new_person_name, new_amount, new_direction, new_due_date=None, new_date=None, new_note=None):
        """Update loan attributes and apply balance recalculations."""
        new_amount = validate_positive_amount(new_amount)
        loan = Loan.objects.select_for_update().get(id=loan_id, user=user)
        balance = BalanceService.get_or_create(user)

        if loan.amount_paid > 0:
            raise ValidationError("To'lov qilingan qarzni miqdorini yoki turini o'zgartirib bo'lmaydi.")

        old_amount = loan.amount
        old_direction = loan.direction

        # Revert old effect
        if old_direction == 'INCOMING':
            validate_sufficient_balance(balance, old_amount)
            balance.total_amount -= old_amount
        elif old_direction == 'OUTGOING':
            balance.total_amount += old_amount

        # Apply new effect
        if new_direction == 'INCOMING':
            balance.total_amount += new_amount
        elif new_direction == 'OUTGOING':
            validate_sufficient_balance(balance, new_amount)
            balance.total_amount -= new_amount

        balance.save(update_fields=['total_amount', 'updated_at'])

        # Find initial transaction
        try:
            old_tx_type = 'LOAN_IN' if old_direction == 'INCOMING' else 'LOAN_OUT'
            initial_tx = Transaction.objects.get(
                user=user, type=old_tx_type,
                source_id=loan.id if old_direction == 'INCOMING' else None,
                destination_id=loan.id if old_direction == 'OUTGOING' else None
            )
            initial_tx.type = 'LOAN_IN' if new_direction == 'INCOMING' else 'LOAN_OUT'
            initial_tx.amount = new_amount
            initial_tx.note = new_note or initial_tx.note
            if new_date:
                initial_tx.date = new_date
            
            if new_direction == 'INCOMING':
                initial_tx.source_type = 'LOAN'
                initial_tx.source_id = loan.id
                initial_tx.destination_type = 'MAIN'
                initial_tx.destination_id = None
            else:
                initial_tx.source_type = 'MAIN'
                initial_tx.source_id = None
                initial_tx.destination_type = 'LOAN'
                initial_tx.destination_id = loan.id
            initial_tx.save()
        except Transaction.DoesNotExist:
            pass

        # Apply updates
        loan.person_name = new_person_name
        loan.amount = new_amount
        loan.direction = new_direction
        loan.due_date = new_due_date
        if new_date:
            loan.date = new_date
        loan.note = new_note
        loan.save()

        return loan

    @staticmethod
    @transaction.atomic
    def delete_loan(user, loan_id):
        """Revert loan balance effects and delete."""
        loan = Loan.objects.select_for_update().get(id=loan_id, user=user)
        balance = BalanceService.get_or_create(user)

        # Effect calculation. 
        # INCOMING: Initial gave +amount to balance. Repayments gave -amount to balance.
        #           Total effect on balance = + loan.amount - loan.amount_paid
        #           Revert = - (loan.amount - loan.amount_paid)
        # OUTGOING: Initial gave -amount to balance. Repayments gave +amount to balance.
        #           Total effect on balance = - loan.amount + loan.amount_paid
        #           Revert = + (loan.amount - loan.amount_paid)

        diff = loan.amount - loan.amount_paid

        if loan.direction == 'INCOMING':
            validate_sufficient_balance(balance, diff)
            balance.total_amount -= diff  # Undo the net money received
        elif loan.direction == 'OUTGOING':
            balance.total_amount += diff  # Undo the net money given

        balance.save(update_fields=['total_amount', 'updated_at'])

        # Cleanup transactions
        from django.db.models import Q
        Transaction.objects.filter(
            user=user
        ).filter(
            Q(source_type='LOAN', source_id=loan.id) |
            Q(destination_type='LOAN', destination_id=loan.id)
        ).delete()

        loan.delete()

    @staticmethod
    @transaction.atomic
    def record_repayment(user, loan_id, amount, note=None, date=None):
        amount = validate_positive_amount(amount)
        loan = Loan.objects.select_for_update().get(id=loan_id, user=user)
        balance = BalanceService.get_or_create(user)

        validate_loan_repayment(loan, amount)

        if loan.direction == 'INCOMING':
            validate_sufficient_balance(balance, amount)

        loan.amount_paid += amount
        if loan.amount_paid >= loan.amount:
            loan.status = 'SETTLED'
        loan.save(update_fields=['amount_paid', 'status', 'updated_at'])

        date_val = date or timezone.now().date()

        if loan.direction == 'INCOMING':
            balance.total_amount -= amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user, type='LOAN_REPAY', amount=amount, source_type='MAIN',
                destination_type='LOAN', destination_id=loan.id, note=note or f"Qarz to'lovi: {loan.person_name}", date=date_val,
            )
        else:
            balance.total_amount += amount
            balance.save(update_fields=['total_amount', 'updated_at'])

            Transaction.objects.create(
                user=user, type='LOAN_REPAY', amount=amount, source_type='LOAN', source_id=loan.id,
                destination_type='MAIN', note=note or f"Qarz qaytarish: {loan.person_name}", date=date_val,
            )

        return loan


class TransferService:
    @staticmethod
    @transaction.atomic
    def transfer(user, from_type, to_type, amount, from_id=None, to_id=None, note=None, date=None):
        amount = validate_positive_amount(amount)
        balance = BalanceService.get_or_create(user)
        group_id = uuid.uuid4()
        date_val = date or timezone.now().date()

        if from_type == 'MAIN':
            validate_sufficient_balance(balance, amount)
            balance.total_amount -= amount
            balance.save(update_fields=['total_amount', 'updated_at'])
        elif from_type == 'SAVINGS':
            savings_from = Savings.objects.select_for_update().get(id=from_id, user=user)
            validate_savings_withdrawal(savings_from, amount)
            savings_from.current_amount -= amount
            savings_from.save(update_fields=['current_amount', 'updated_at'])

        if to_type == 'MAIN':
            balance.total_amount += amount
            balance.save(update_fields=['total_amount', 'updated_at'])
        elif to_type == 'SAVINGS':
            savings_to = Savings.objects.select_for_update().get(id=to_id, user=user)
            savings_to.current_amount += amount
            savings_to.save(update_fields=['current_amount', 'updated_at'])

        tx = Transaction.objects.create(
            user=user, type='TRANSFER', amount=amount, source_type=from_type, source_id=from_id,
            destination_type=to_type, destination_id=to_id, transaction_group_id=group_id,
            note=note or f"O'tkazma: {from_type} → {to_type}", date=date_val,
        )
        return tx


class NotificationService:
    @staticmethod
    def create(user, title, message, notification_type='INFO', related_type=None, related_id=None):
        notification = Notification.objects.create(
            user=user, title=title, message=message, type=notification_type,
            related_object_type=related_type, related_object_id=related_id,
        )
        try:
            from apps.telegram.services import TelegramService
            TelegramService.send_notification(user, notification)
        except Exception:
            pass
        return notification

    @staticmethod
    def check_savings_minimum(user, savings):
        if savings.is_below_minimum:
            NotificationService.create(
                user=user, title=f"⚠️ Jamg'arma chegaradan past: {savings.name}",
                message=f"{savings.name} jamg'arma balansi ({savings.current_amount:,.0f} so'm) minimal chegaradan ({savings.minimum_limit:,.0f} so'm) pastga tushdi.",
                notification_type='SAVINGS_LOW', related_type='savings', related_id=savings.id,
            )

    @staticmethod
    def check_expense_spike(user, amount):
        from django.db.models import Avg
        from datetime import timedelta

        avg_expense = Transaction.objects.filter(
            user=user, type='EXPENSE', date__gte=timezone.now().date() - timedelta(days=30),
        ).aggregate(avg=Avg('amount'))['avg']

        if avg_expense and amount > Decimal(str(avg_expense)) * 3:
            NotificationService.create(
                user=user, title="🔴 Katta xarajat aniqlandi!",
                message=f"{amount:,.0f} so'm xarajat qayd etildi. Bu oxirgi 30 kunlik o'rtacha ({avg_expense:,.0f} so'm) dan 3 baravar ko'p.",
                notification_type='EXPENSE_SPIKE',
            )
        
        # Aqlli iqtisod qoidasi: Oylik byudjet nazorati
        NotificationService.check_expense_ratio(user)

    @staticmethod
    def check_expense_ratio(user):
        """Check if monthly expenses exceed 80% of monthly income."""
        from django.db.models import Sum
        from datetime import datetime
        
        now = datetime.now()
        start_of_month = now.replace(day=1).date()
        
        monthly_income = Transaction.objects.filter(
            user=user, type='INCOME', date__gte=start_of_month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        monthly_expense = Transaction.objects.filter(
            user=user, type='EXPENSE', date__gte=start_of_month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        if monthly_income > 0:
            ratio = (monthly_expense / monthly_income) * 100
            
            if ratio >= 80:
                # Check if we already notified this month about 80%
                existing = Notification.objects.filter(
                    user=user,
                    type='EXPENSE_WARNING',
                    created_at__gte=start_of_month
                ).exists()
                
                if not existing:
                    NotificationService.create(
                        user=user,
                        title="⚠️ Diqqat! Moliyaviy intizom!",
                        message=f"Iqtisod qoidasi! Bu oygi xarajatlaringiz ({monthly_expense:,.0f} so'm) daromadingizdan ({monthly_income:,.0f} so'm) {ratio:.1f}% ni tashkil qilmoqda. Iltimos, xarajatlarni nazorat qiling!",
                        notification_type='EXPENSE_WARNING',
                    )

    @staticmethod
    def check_loan_due_dates(user):
        from datetime import timedelta
        threshold = timezone.now().date() + timedelta(days=3)

        due_soon = Loan.objects.filter(
            user=user, status='ACTIVE', due_date__isnull=False, due_date__lte=threshold,
        )

        for loan in due_soon:
            existing = Notification.objects.filter(
                user=user, type='LOAN_DUE', related_object_type='loan',
                related_object_id=loan.id, created_at__date=timezone.now().date(),
            ).exists()

            if not existing:
                NotificationService.create(
                    user=user, title=f"⏰ Qarz muddati yaqinlashmoqda: {loan.person_name}",
                    message=f"{loan.person_name}ga {loan.remaining_amount:,.0f} so'm qarz {loan.due_date} sanagacha to'lanishi kerak.",
                    notification_type='LOAN_DUE', related_type='loan', related_id=loan.id,
                )
