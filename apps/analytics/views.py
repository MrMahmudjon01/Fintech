from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.utils import timezone

from .reports import MainBalanceReport, SavingsReport, LoanReport, GlobalReport
from .exports import export_weekly_balance, export_monthly_all, export_yearly_all


class DashboardView(APIView):
    """Main dashboard analytics."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))

        return Response({
            'income_vs_expense': GlobalReport.income_vs_expense(user, year, month),
            'category_breakdown': GlobalReport.category_breakdown(user, year, month),
        })


class WeeklyReportView(APIView):
    """Weekly balance report."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report = MainBalanceReport.weekly(request.user)
        return Response(report)


class MonthlyReportView(APIView):
    """Monthly combined report."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))

        return Response({
            'balance': MainBalanceReport.monthly(request.user, year, month),
            'savings': SavingsReport.monthly(request.user, year, month),
            'loans': LoanReport.monthly(request.user, year, month),
            'income_vs_expense': GlobalReport.income_vs_expense(request.user, year, month),
            'categories': GlobalReport.category_breakdown(request.user, year, month),
        })


class YearlyReportView(APIView):
    """Yearly combined report."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        year = int(request.query_params.get('year', now.year))

        return Response({
            'balance': MainBalanceReport.yearly(request.user, year),
            'savings': SavingsReport.yearly(request.user, year),
            'loans': LoanReport.yearly(request.user, year),
            'income_vs_expense': GlobalReport.income_vs_expense(request.user, year),
            'categories': GlobalReport.category_breakdown(request.user, year),
        })


# ─────────────────────────────────────────────────────────
# EXPORT ENDPOINTS
# ─────────────────────────────────────────────────────────
class ExportWeeklyView(APIView):
    """Download weekly report as Excel."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        buffer, filename = export_weekly_balance(request.user)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ExportMonthlyView(APIView):
    """Download monthly report as Excel."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))

        buffer, filename = export_monthly_all(request.user, year, month)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ExportYearlyView(APIView):
    """Download yearly report as Excel."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        year = int(request.query_params.get('year', now.year))

        buffer, filename = export_yearly_all(request.user, year)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
