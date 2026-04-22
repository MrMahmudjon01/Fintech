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

        txs = Transaction.objects.filter(
            user=user, date__gte=week_start, date__lte=week_end, is_deleted=False
        )

        daily_data = {}
        for t in txs:
            day = t.date
            if day not in daily_data:
                daily_data[day] = {
                    'income': 0, 'expense': 0, 'savings_deposit': 0, 
                    'savings_withdraw': 0, 'loan_in': 0, 'loan_out': 0, 'loan_repay': 0
                }
            if t.type == 'INCOME': daily_data[day]['income'] += t.amount
            elif t.type == 'EXPENSE': daily_data[day]['expense'] += t.amount
            elif t.type == 'SAVINGS_DEPOSIT': daily_data[day]['savings_deposit'] += t.amount
            elif t.type == 'SAVINGS_WITHDRAW': daily_data[day]['savings_withdraw'] += t.amount
            elif t.type == 'LOAN_IN': daily_data[day]['loan_in'] += t.amount
            elif t.type == 'LOAN_OUT': daily_data[day]['loan_out'] += t.amount
            elif t.type == 'LOAN_REPAY': daily_data[day]['loan_repay'] += t.amount

        # Fill in missing days
        result = []
        for i in range(7):
            day = week_start + timedelta(days=i)
            day_stats = daily_data.get(day, {})
            result.append({
                'day': day.isoformat(),
                'day_name': day.strftime('%A'),
                'income': float(day_stats.get('income', 0)),
                'expense': float(day_stats.get('expense', 0)),
                'savings_deposit': float(day_stats.get('savings_deposit', 0)),
                'savings_withdraw': float(day_stats.get('savings_withdraw', 0)),
                'loan_in': float(day_stats.get('loan_in', 0)),
                'loan_out': float(day_stats.get('loan_out', 0)),
                'loan_repay': float(day_stats.get('loan_repay', 0)),
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

        txs = Transaction.objects.filter(
            user=user, date__gte=start, date__lte=end, is_deleted=False
        )

        daily_data = {}
        totals = {'income': 0.0, 'expense': 0.0, 'savings_in': 0.0, 'savings_out': 0.0, 'loan_in': 0.0, 'loan_out': 0.0}

        for t in txs:
            day_str = t.date.isoformat()
            if day_str not in daily_data:
                daily_data[day_str] = {'income': 0.0, 'expense': 0.0}
            
            amt = float(t.amount)
            if t.type == 'INCOME':
                daily_data[day_str]['income'] += amt
                totals['income'] += amt
            elif t.type == 'EXPENSE':
                daily_data[day_str]['expense'] += amt
                totals['expense'] += amt
            elif t.type == 'SAVINGS_DEPOSIT': totals['savings_in'] += amt
            elif t.type == 'SAVINGS_WITHDRAW': totals['savings_out'] += amt
            elif t.type == 'LOAN_IN': totals['loan_in'] += amt
            elif t.type == 'LOAN_OUT': totals['loan_out'] += amt

        result_daily = []
        for day_str in sorted(daily_data.keys()):
            result_daily.append({
                'day': day_str,
                'income': daily_data[day_str]['income'],
                'expense': daily_data[day_str]['expense'],
            })

        return {
            'period': 'monthly',
            'year': year,
            'month': month,
            'daily': result_daily,
            'totals': totals,
        }

    @staticmethod
    def yearly(user, year):
        """Yearly report with monthly aggregates."""
        start = date(year, 1, 1)
        end = date(year, 12, 31)

        txs = Transaction.objects.filter(
            user=user, date__gte=start, date__lte=end, is_deleted=False
        )

        monthly_data = {}
        for m in range(1, 13):
            month_str = date(year, m, 1).isoformat()
            monthly_data[m] = {'month': month_str, 'income': 0.0, 'expense': 0.0}

        for t in txs:
            m = t.date.month
            amt = float(t.amount)
            if t.type == 'INCOME':
                monthly_data[m]['income'] += amt
            elif t.type == 'EXPENSE':
                monthly_data[m]['expense'] += amt

        result = []
        for m in range(1, 13):
            d = monthly_data[m]
            d['net'] = d['income'] - d['expense']
            if d['income'] > 0 or d['expense'] > 0:
                result.append(d)

        return {
            'period': 'yearly',
            'year': year,
            'monthly': result,
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

        all_txs = list(Transaction.objects.filter(
            user=user, date__gte=start, date__lte=end, is_deleted=False
        ).filter(
            Q(type='SAVINGS_DEPOSIT') | Q(type='SAVINGS_WITHDRAW')
        ))

        for s in savings_list:
            monthly_data = {m: {'deposits': 0.0, 'withdrawals': 0.0} for m in range(1, 13)}

            for t in all_txs:
                m = t.date.month
                amt = float(t.amount)
                if t.type == 'SAVINGS_DEPOSIT' and t.destination_id == s.id:
                    monthly_data[m]['deposits'] += amt
                elif t.type == 'SAVINGS_WITHDRAW' and t.source_id == s.id:
                    monthly_data[m]['withdrawals'] += amt

            s_monthly = []
            for m in range(1, 13):
                d = monthly_data[m]
                if d['deposits'] > 0 or d['withdrawals'] > 0:
                    s_monthly.append({
                        'month': date(year, m, 1).isoformat(),
                        'deposits': d['deposits'],
                        'withdrawals': d['withdrawals']
                    })

            result.append({
                'id': s.id,
                'name': s.name,
                'current_amount': float(s.current_amount),
                'monthly': s_monthly,
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
