from django.core.management.base import BaseCommand
from apps.finance.services import NotificationService
from apps.users.models import User

class Command(BaseCommand):
    help = 'Checks for loans due, savings limits, and other notifications'

    def handle(self, *args, **options):
        self.stdout.write('Checking notifications...')
        for user in User.objects.filter(is_active=True):
            NotificationService.check_loan_due_dates(user)
        self.stdout.write(self.style.SUCCESS('Notification check completed.'))
