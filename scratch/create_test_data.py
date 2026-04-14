import os
import sys
import django
import random
from datetime import timedelta

# Loyiha ildizini pathga qo'shish
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import django
from django.utils import timezone

# Django muhitini sozlash
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.finance.models import Category, Transaction, Debt, Savings
from decimal import Decimal

def generate_test_data(phone_number, password):
    # 1. User yaratish
    user, created = User.objects.get_or_create(phone_number=phone_number)
    user.set_password(password)
    user.save()
    
    # Eskidan malumotlar bo'lsa o'chirib tashlaymiz (toza test uchun)
    Category.objects.filter(user=user).delete()
    Debt.objects.filter(user=user).delete()
    Savings.objects.filter(user=user).delete()
    Transaction.objects.filter(user=user).delete()

    print(f"User: {phone_number} tayyorlandi.")

    # 2. Kategoriyalar yaratish
    categories_names = ["Oziq-ovqat", "Transport", "Ijara", "O'yin-kulgu", "Salomatlik", "Maosh", "Bonus"]
    cats = []
    for name in categories_names:
        cats.append(Category.objects.create(user=user, name=name))

    # 3. Jamg'armalar (Savings)
    savings_goals = [
        {"name": "Yangi iPhone", "target": 12000000, "monthly": 1000000},
        {"name": "Sayohat (Turkiya)", "target": 15000000, "monthly": 2000000},
        {"name": "Mashina uchun", "target": 100000000, "monthly": 5000000},
    ]
    goals = []
    for goal in savings_goals:
        s = Savings.objects.create(
            user=user, 
            name=goal['name'], 
            target_amount=goal['target'], 
            monthly_contribution=goal['monthly'],
            current_amount=random.randint(500000, 3000000)
        )
        goals.append(s)

    # 4. Tranzaksiyalar (Transactions) - Oxirgi 30 kun uchun
    today = timezone.now().date()
    for i in range(50):
        date = today - timedelta(days=random.randint(0, 30))
        tx_type = random.choice(['INCOME', 'EXPENSE', 'SAVING'])
        amount = random.randint(10000, 500000)
        
        cat = random.choice(cats)
        saving = None
        if tx_type == 'SAVING':
            saving = random.choice(goals)
            cat = None # Jamg'armaga kategoriya shartmas
        
        Transaction.objects.create(
            user=user,
            category=cat,
            savings=saving,
            amount=amount,
            type=tx_type,
            note=f"Test tranzaksiya {i}",
            date=date
        )

    # 5. Qarzlar (Debts)
    people = ["Ali", "Vali", "G'ani", "Salim", "Anvar"]
    for i in range(10):
        d_type = random.choice(['BORROWED', 'LENT'])
        amount = random.randint(100000, 2000000)
        paid = random.randint(0, amount // 2)
        
        Debt.objects.create(
            user=user,
            person_name=random.choice(people),
            amount=amount,
            amount_paid=paid,
            type=d_type,
            date=today - timedelta(days=random.randint(0, 20)),
            due_date=today + timedelta(days=random.randint(5, 30)) if random.choice([True, False]) else None,
            status='ACTIVE'
        )

    print("Barcha test malumotlari muvaffaqiyatli qo'shildi!")

if __name__ == "__main__":
    generate_test_data("+998901234567", "testpass123")
