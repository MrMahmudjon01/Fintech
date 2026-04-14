from django.apps import AppConfig
from django.db.backends.signals import connection_created
from django.dispatch import receiver

class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finance'

    def ready(self):
        pass

@receiver(connection_created)
def activate_foreign_keys(sender, connection, **kwargs):
    """Enable foreign key constraints in SQLite"""
    if connection.vendor == 'sqlite':
        cursor = connection.cursor()
        cursor.execute('PRAGMA foreign_keys = ON;')
