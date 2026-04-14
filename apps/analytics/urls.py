from django.urls import path
from .views import (
    DashboardView,
    WeeklyReportView, MonthlyReportView, YearlyReportView,
    ExportWeeklyView, ExportMonthlyView, ExportYearlyView,
)

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),

    # Reports
    path('reports/weekly/', WeeklyReportView.as_view(), name='report_weekly'),
    path('reports/monthly/', MonthlyReportView.as_view(), name='report_monthly'),
    path('reports/yearly/', YearlyReportView.as_view(), name='report_yearly'),

    # Excel exports
    path('export/weekly/', ExportWeeklyView.as_view(), name='export_weekly'),
    path('export/monthly/', ExportMonthlyView.as_view(), name='export_monthly'),
    path('export/yearly/', ExportYearlyView.as_view(), name='export_yearly'),
]
