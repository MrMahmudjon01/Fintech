from decimal import Decimal
from django.core.exceptions import ValidationError


def validate_positive_amount(amount):
    """Ensure amount is positive."""
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValidationError("Summa musbat bo'lishi kerak (amount must be positive).")
    return amount


def validate_sufficient_balance(balance_obj, amount):
    """Check that main balance has enough funds."""
    amount = Decimal(str(amount))
    if balance_obj.total_amount < amount:
        raise ValidationError(
            f"Yetarli mablag' yo'q. Balans: {balance_obj.total_amount}, Kerakli: {amount}"
        )


def validate_savings_withdrawal(savings, amount):
    """Check that withdrawal doesn't drop savings below minimum_limit."""
    amount = Decimal(str(amount))
    remaining = savings.current_amount - amount
    if remaining < savings.minimum_limit:
        raise ValidationError(
            f"Yechish mumkin emas. Minimal chegara: {savings.minimum_limit}, "
            f"Yechgandan keyin: {remaining}"
        )
    if remaining < 0:
        raise ValidationError(
            f"Yetarli mablag' yo'q. Mavjud: {savings.current_amount}, Kerakli: {amount}"
        )


def validate_savings_goal_allocation(savings):
    """Check that savings is above minimum_limit before allowing goal allocation."""
    if savings.current_amount < savings.minimum_limit:
        raise ValidationError(
            f"Jamg'arma minimal chegaradan past ({savings.current_amount} < {savings.minimum_limit}). "
            f"Maqsadga pul ajratib bo'lmaydi."
        )


def validate_loan_repayment(loan, amount):
    """Ensure repayment doesn't exceed remaining amount."""
    amount = Decimal(str(amount))
    remaining = loan.remaining_amount
    if amount > remaining:
        raise ValidationError(
            f"To'lov qarz qoldig'idan oshib ketdi. Qolgan: {remaining}, To'lov: {amount}"
        )
