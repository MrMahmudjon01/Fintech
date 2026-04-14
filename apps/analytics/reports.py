from decimal import Decimal
from datetime import timedelta, date
from django.db.models import Sum, Avg, Count, Q
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from django.utils import timezone

from apps.finance.models import Transaction, Savings, Loan, MainBalance


class MainBalanceReport:
    """Reports for main balance."""

    @staticmethod
    def weekly(user, target_date=None):
        """Weekly report: daily breakdown of income/expense/net."""
        if target_date is None:
            target_date = timezone.now().date()

        # Find the start of the week (Monday)
        week_start = target_date - timedelta(days=target_date.weekday())
        week_end = week_start + timedelta(days=6)

        daily = Transaction.objects.filter(
            user=user,
            date__gte=week_start,
            date__lte=week_end,
        ).annotate(
            day=TruncDate('date')
        ).values('day').annotate(
            income=Sum('amount', filter=Q(type='INCOME')),
            expense=Sum('amount', filter=Q(type='EXPENSE')),
            savings_deposit=Sum('amount', filter=Q(type='SAVINGS_DEPOSIT')),
            savings_withdraw=Sum('amount', filter=Q(type='SAVINGS_WITHDRAW')),
            loan_in=Sum('amount', filter=Q(type='LOAN_IN')),
            loan_out=Sum('amount', filter=Q(type='LOAN_OUT')),
            loan_repay=Sum('amount', filter=Q(type='LOAN_REPAY')),
        ).order_by('day')

        # Fill in missing days
        result = []
        for i in range(7):
            day = week_start + timedelta(days=i)
            day_data = next((d for d in daily if d['day'] == day), None)
            result.append({
                'day': day.isoformat(),
                'day_name': day.strftime('%A'),
                'income': float(day_data['income'] or 0) if day_data else 0,
                'expense': float(day_data['expense'] or 0) if day_data else 0,
                'savings_deposit': float(day_data['savings_deposit'] or 0) if day_data else 0,
                'savings_withdraw': float(day_data['savings_withdraw'] or 0) if day_data else 0,
                'loan_in': float(day_data['loan_in'] or 0) if day_data else 0,
                'loan_out': float(day_data['loan_out'] or 0) if day_data else 0,
                'loan_repay': float(day_data['loan_repay'] or 0) if day_data else 0,
            })

        totals = {
            'income': sum(d['income'] for d in result),
            'expense': sum(d['expense'] for d in result),
            'net': sum(d['income'] for d in result) - sum(d['expense'] for d in result),
        }

        return {
            'period': 'weekly',
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'daily': result,
            'totals': totals,
        }

    @staticmethod
    def monthly(user, year, month):
        """Monthly report with daily aggregates."""
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)

        daily = Transaction.objects.filter(
            user=user,
            date__gte=start,
            date__lte=end,
        ).annotate(
            day=TruncDate('date')
        ).values('day').annotate(
            income=Sum('amount', filter=Q(type='INCOME')),
            expense=Sum('amount', filter=Q(type='EXPENSE')),
        ).order_by('day')

        totals = Transaction.objects.filter(
            user=user,
            date__gte=start,
            date__lte=end,
        ).aggregate(
            income=Sum('amount', filter=Q(type='INCOME')),
            expense=Sum('amount', filter=Q(type='EXPENSE')),
            savings_in=Sum('amount', filter=Q(type='SAVINGS_DEPOSIT')),
            savings_out=Sum('amount', filter=Q(type='SAVINGS_WITHDRAW')),
            loan_in=Sum('amount', filter=Q(type='LOAN_IN')),
            loan_out=Sum('amount', filter=Q(type='LOAN_OUT')),
        )

        return {
            'period': 'monthly',
            'year': year,
            'month': month,
            'daily': [
                {
                    'day': d['day'].isoformat() if d['day'] else None,
                    'income': float(d['income'] or 0),
                    'expense': float(d['expense'] or 0),
                }
                for d in daily
            ],
            'totals': {k: float(v or 0) for k, v in totals.items()},
        }

    @staticmethod
    def yearly(user, year):
        """Yearly report with monthly aggregates."""
        start = date(year, 1, 1)
        end = date(year, 12, 31)

        monthly = Transaction.objects.filter(
            user=user,
            date__gte=start,
            date__lte=end,
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            income=Sum('amount', filter=Q(type='INCOME')),
            expense=Sum('amount', filter=Q(type='EXPENSE')),
        ).order_by('month')

        return {
            'period': 'yearly',
            'year': year,
            'monthly': [
                {
                    'month': d['month'].isoformat() if d['month'] else None,
                    'income': float(d['income'] or 0),
                    'expense': float(d['expense'] or 0),
                    'net': float((d['income'] or 0) - (d['expense'] or 0)),
                }
                for d in monthly
            ],
        }


class SavingsReport:
    """Reports for savings accounts."""

    @staticmethod
    def monthly(user, year, month):
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)

        savings_list = Savings.objects.filter(user=user)
        result = []

        for s in savings_list:
            txs = Transaction.objects.filter(
                user=user,
                date__gte=start,
                date__lte=end,
            ).filter(
                Q(source_type='SAVINGS', source_id=s.id) |
                Q(destination_type='SAVINGS', destination_id=s.id)
            ).aggregate(
                deposits=Sum('amount', filter=Q(type='SAVINGS_DEPOSIT', destination_id=s.id)),
                withdrawals=Sum('amount', filter=Q(type='SAVINGS_WITHDRAW', source_id=s.id)),
            )

            result.append({
                'id': s.id,
                'name': s.name,
                'current_amount': float(s.current_amount),
                'target_amount': float(s.target_amount or 0),
                'deposits': float(txs['deposits'] or 0),
                'withdrawals': float(txs['withdrawals'] or 0),
                'net': float((txs['deposits'] or 0) - (txs['withdrawals'] or 0)),
            })

        return {
            'period': 'monthly',
            'year': year,
            'month': month,
            'accounts': result,
        }

    @staticmethod
    def yearly(user, year):
        start = date(year, 1, 1)
        end = date(year, 12, 31)

        savings_list = Savings.objects.filter(user=user)
        result = []

        for s in savings_list:
            monthly_data = Transaction.objects.filter(
                user=user,
                date__gte=start,
                date__lte=end,
            ).filter(
                Q(source_type='SAVINGS', source_id=s.id) |
                Q(destination_type='SAVINGS', destination_id=s.id)
            ).annotate(
                month=TruncMonth('date')
            ).values('month').annotate(
                deposits=Sum('amount', filter=Q(type='SAVINGS_DEPOSIT', destination_id=s.id)),
                withdrawals=Sum('amount', filter=Q(type='SAVINGS_WITHDRAW', source_id=s.id)),
            ).order_by('month')

            result.append({
                'id': s.id,
                'name': s.name,
                'current_amount': float(s.current_amount),
                'monthly': [
                    {
                        'month': d['month'].isoformat() if d['month'] else None,
                        'deposits': float(d['deposits'] or 0),
                        'withdrawals': float(d['withdrawals'] or 0),
                    }
                    for d in monthly_data
                ],
            })

        return {
            'period': 'yearly',
            'year': year,
            'accounts': result,
        }


class LoanReport:
    """Reports for loans."""

    @staticmethod
    def monthly(user, year, month):
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)

        new_loans = Loan.objects.filter(
            user=user, date__gte=start, date__lte=end
        ).aggregate(
            incoming=Sum('amount', filter=Q(direction='INCOMING')),
            outgoing=Sum('amount', filter=Q(direction='OUTGOING')),
            count=Count('id'),
        )

        repayments = Transaction.objects.filter(
            user=user,
            type='LOAN_REPAY',
            date__gte=start,
            date__lte=end,
        ).aggregate(
            total=Sum('amount'),
            count=Count('id'),
        )

        outstanding = Loan.objects.filter(
            user=user, status='ACTIVE'
        ).aggregate(
            incoming=Sum('amount', filter=Q(direction='INCOMING')) or 0,
            outgoing=Sum('amount', filter=Q(direction='OUTGOING')) or 0,
            paid=Sum('amount_paid'),
        )

        return {
            'period': 'monthly',
            'year': year,
            'month': month,
            'new_loans': {k: float(v or 0) for k, v in new_loans.items()},
            'repayments': {k: float(v or 0) for k, v in repayments.items()},
            'outstanding': {k: float(v or 0) for k, v in outstanding.items()},
        }

    @staticmethod
    def yearly(user, year):
        start = date(year, 1, 1)
        end = date(year, 12, 31)

        monthly = []
        for m in range(1, 13):
            monthly.append(LoanReport.monthly(user, year, m))

        return {
            'period': 'yearly',
            'year': year,
            'monthly': monthly,
        }


class GlobalReport:
    """Cross-cutting analytics."""

    @staticmethod
    def income_vs_expense(user, year, month=None):
        """Compare income vs expense for a period."""
        if month:
            start = date(year, month, 1)
            end = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31)
        else:
            start = date(year, 1, 1)
            end = date(year, 12, 31)

        data = Transaction.objects.filter(
            user=user,
            date__gte=start,
            date__lte=end,
        ).aggregate(
            income=Sum('amount', filter=Q(type='INCOME')),
            expense=Sum('amount', filter=Q(type='EXPENSE')),
        )

        income = float(data['income'] or 0)
        expense = float(data['expense'] or 0)

        return {
            'income': income,
            'expense': expense,
            'net': income - expense,
            'savings_rate': round((income - expense) / income * 100, 1) if income > 0 else 0,
        }

    @staticmethod
    def category_breakdown(user, year, month=None):
        """Spending breakdown by category."""
        if month:
            start = date(year, month, 1)
            end = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31)
        else:
            start = date(year, 1, 1)
            end = date(year, 12, 31)

        data = Transaction.objects.filter(
            user=user,
            type='EXPENSE',
            date__gte=start,
            date__lte=end,
        ).values(
            'category__name'
        ).annotate(
            total=Sum('amount'),
            count=Count('id'),
        ).order_by('-total')

        return [
            {
                'category': d['category__name'] or 'Kategoriyasiz',
                'total': float(d['total'] or 0),
                'count': d['count'],
            }
            for d in data
        ]
