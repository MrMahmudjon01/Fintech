from django.core.management.base import BaseCommand
from apps.telegram.bot import run_bot

class Command(BaseCommand):
    help = 'Telegram botni ishga tushirish'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Bot ishga tushirilmoqda...'))
        try:
            run_bot()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Xatolik: {e}'))
