"""
Har kuni soat 21:00 da ishga tushirilishi kerak:
  crontab: 0 21 * * * /path/to/venv/bin/python /path/to/manage.py send_daily_reminder

Bu buyruq quyidagilarni bajaradi:
1. Bugun xarajat qo'shmaganlarga eslatma yuboradi.
2. Qarz/kredit muddati kelayotganlarga (3 kun oldin va muddat kuni) eslatma yuboradi.
3. Muddat ko'rsatilmagan qarzlar uchun oyning oxirgi kuni eslatma yuboradi.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.finance.models import Notification, Transaction, Debt, Savings
from django.contrib.auth import get_user_model
from datetime import timedelta
import calendar

User = get_user_model()

class Command(BaseCommand):
    help = "Har kuni bildirishnomalarni va eslatmalarni yozish"

    def handle(self, *args, **options):
        today = timezone.now().date()
        users = User.objects.all()
        
        # Oyning oxirgi kuni ekanligini tekshirish
        _, last_day_num = calendar.monthrange(today.year, today.month)
        is_last_day_of_month = today.day == last_day_num
        
        three_days_later = today + timedelta(days=3)
        
        count_reminders = 0
        count_debts = 0
        count_savings = 0

        is_first_day_of_month = today.day == 1

        for user in users:
            # 0. Avtomatik Jamg'arma To'ldirish (Agar oyning birinchi kuni bo'lsa)
            if is_first_day_of_month:
                active_savings = Savings.objects.filter(user=user, status='ACTIVE')
                for saving in active_savings:
                    if saving.monthly_contribution > 0:
                        saving.current_amount += saving.monthly_contribution
                        if saving.current_amount >= saving.target_amount:
                            saving.status = 'COMPLETED'
                        saving.save()
                        
                        # Tranzaksiya yaratish
                        Transaction.objects.create(
                            user=user,
                            amount=saving.monthly_contribution,
                            type='SAVING',
                            note=f"Avtomatik oylik jamg'arma: {saving.name}",
                            savings=saving,
                            date=today
                        )
                        count_savings += 1
            # 1. Xarajat eslatmasi
            has_expense_today = Transaction.objects.filter(
                user=user,
                date=today,
                type='EXPENSE'
            ).exists()

            if not has_expense_today:
                Notification.objects.create(
                    user=user,
                    title="Bugungi xarajatlar",
                    message="Bugun hali xarajat qo'shmagansiz. Bugungi xarajatlaringizni kiritishni unutmang!",
                    type='REMINDER'
                )
                count_reminders += 1

            # 2. Qarz eslatmalari
            active_debts = Debt.objects.filter(user=user, status='ACTIVE')
            
            for debt in active_debts:
                debt_type_str = "bergan qarzingizni" if debt.type == 'LENT' else "olgan qarzingizni"
                msg_prefix = f"{debt.person_name} ismli shaxsga {debt_type_str}"
                amount_str = f"{int(debt.amount - debt.amount_paid):,}".replace(',', ' ') + " so'm"
                
                # Muddat ko'rsatilgan bo'lsa
                if debt.due_date:
                    if debt.due_date == three_days_later:
                        Notification.objects.create(
                            user=user,
                            title="Qarz muddati yaqinlashmoqda",
                            message=f"3 kundan keyin ({debt.due_date}) {msg_prefix} qaytarish/olish vaqti keladi. Qolgan summa: {amount_str}",
                            type='REMINDER'
                        )
                        count_debts += 1
                    elif debt.due_date == today:
                        Notification.objects.create(
                            user=user,
                            title="Bugun qarz qaytarish kuni!",
                            message=f"Bugun ({debt.due_date}) {msg_prefix} yopish muddati keldi. Qolgan summa: {amount_str}",
                            type='REMINDER'
                        )
                        count_debts += 1
                
                # Muddat ko'rsatilmagan bo'lsa - oyning oxirgi kuni
                elif is_last_day_of_month:
                    Notification.objects.create(
                        user=user,
                        title="Oylik qarz eslatmasi",
                        message=f"Oyning oxirgi kuni keldi. {msg_prefix} haqida unutmang. Qolgan summa: {amount_str}",
                        type='REMINDER'
                    )
                    count_debts += 1

        self.stdout.write(self.style.SUCCESS(
            f"Tugallandi: {count_reminders} ta xarajat eslatmasi, {count_debts} ta qarz bildirishnomasi va {count_savings} ta jamg'arma to'ldirildi."
        ))
