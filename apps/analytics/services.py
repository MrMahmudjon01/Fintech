from django.db.models import Sum
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from apps.finance.models import Transaction

def get_daily_analytics(user):
    return Transaction.objects.filter(user=user).annotate(
        date=TruncDate('created_at')
    ).values('date', 'type').annotate(
        total=Sum('amount')
    ).order_by('-date')

def get_weekly_analytics(user):
    return Transaction.objects.filter(user=user).annotate(
        week=TruncWeek('created_at')
    ).values('week', 'type').annotate(
        total=Sum('amount')
    ).order_by('-week')

def get_monthly_analytics(user):
    return Transaction.objects.filter(user=user).annotate(
        month=TruncMonth('created_at')
    ).values('month', 'type').annotate(
        total=Sum('amount')
    ).order_by('-month')

def get_category_breakdown(user):
    return Transaction.objects.filter(user=user).values(
        'category__name', 'type'
    ).annotate(
        total=Sum('amount')
    ).order_by('-total')
