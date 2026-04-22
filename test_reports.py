import os
import django
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.analytics.reports import MainBalanceReport
from apps.analytics.exports import export_weekly_balance

user = User.objects.first()
if not user:
    print("No user found.")
    sys.exit()

try:
    print("Testing weekly report...")
    res = MainBalanceReport.weekly(user)
    print("Success:", res['totals'])
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("Testing export weekly...")
    export_weekly_balance(user)
    print("Export Success")
except Exception as e:
    import traceback
    traceback.print_exc()
