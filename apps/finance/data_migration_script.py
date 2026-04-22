import os
import django
from decimal import Decimal
import uuid

# Setup Django
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
# django.setup()

from apps.finance.models import Category, Transaction, Debt, Savings, Goal
from apps.users.models import User

def run_migration():
    print("Starting data migration...")
    
    # 1. Update Categories
    for cat in Category.objects.all():
        name_lower = cat.name.lower()
        if any(keyword in name_lower for keyword in ['daromad', 'oylik', 'income', 'salary', 'kishi']):
            cat.type = 'INCOME'
        else:
            cat.type = 'EXPENSE'
        cat.save()
    print("Categories updated.")

    # 2. Update Transactions
    transactions = list(Transaction.objects.all())
    for tx in transactions:
        group_id = uuid.uuid4()
        
        if tx.savings_old:
            if tx.type == 'SAVING':
                # This was "Adding to savings"
                # Leg 1: Expense from MAIN
                tx.source_type = 'MAIN'
                tx.type = 'EXPENSE'
                tx.transaction_group_id = group_id
                tx.note = f"Depozit: {tx.savings_old.name}"
                tx.save()
                
                # Leg 2: Income to SAVINGS
                Transaction.objects.create(
                    user=tx.user,
                    amount=tx.amount,
                    type='INCOME',
                    source_type='SAVINGS',
                    source_id=tx.savings_old.id,
                    transaction_group_id=group_id,
                    note=f"Kirim: {tx.savings_old.name}",
                    date=tx.date
                )
            else:
                # Other types linked to savings
                tx.source_type = 'SAVINGS'
                tx.source_id = tx.savings_old.id
                tx.save()
        elif tx.debt_old:
            tx.source_type = 'DEBT'
            tx.source_id = tx.debt_old.id
            tx.save()
        else:
            tx.source_type = 'MAIN'
            tx.save()
            
    print("Transactions sources updated and double-entries created for SAVING type.")

    # 3. Calculate and set Balances
    # Re-calculate EVERYTHING from the new Transaction records
    for saving in Savings.objects.all():
        income = Transaction.objects.filter(source_type='SAVINGS', source_id=saving.id, type='INCOME').aggregate(django.db.models.Sum('amount'))['amount__sum'] or 0
        expense = Transaction.objects.filter(source_type='SAVINGS', source_id=saving.id, type='EXPENSE').aggregate(django.db.models.Sum('amount'))['amount__sum'] or 0
        saving.balance = Decimal(str(income)) - Decimal(str(expense))
        saving.save()
    print("Savings balances updated.")

    for user in User.objects.all():
        inc = Transaction.objects.filter(user=user, source_type='MAIN', type='INCOME').aggregate(django.db.models.Sum('amount'))['amount__sum'] or 0
        exp = Transaction.objects.filter(user=user, source_type='MAIN', type='EXPENSE').aggregate(django.db.models.Sum('amount'))['amount__sum'] or 0
        user.main_balance = Decimal(str(inc)) - Decimal(str(exp))
        
        user.savings_balance = sum(s.balance for s in Savings.objects.filter(user=user))
        user.save()
    print("User balances updated.")

    print("Migration finished successfully.")

if __name__ == "__main__":
    run_migration()
