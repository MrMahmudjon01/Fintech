import os
import django
import sys

# Loyiha ildizini pathga qo'shish
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.finance.serializers import TransactionCreateSerializer

data = {
    'amount': '1000',
    'type': 'EXPENSE',
    'category': '',  # Test empty string
    'savings_id': '', # Test empty string
    'note': 'Test',
    'date': '2026-04-13'
}

serializer = TransactionCreateSerializer(data=data)
if not serializer.is_valid():
    print(f"Validation Error: {serializer.errors}")
else:
    print("Validation Success")
