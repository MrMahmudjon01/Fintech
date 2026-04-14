from telegram import Bot
from django.conf import settings
import asyncio

class TelegramService:
    """Service to send messages to users via Telegram bot."""

    @staticmethod
    def send_message(chat_id, text):
        """Send a simple text message."""
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        if not token or token == "YOUR_BOT_TOKEN" or not chat_id:
            return False
            
        try:
            bot = Bot(token=token)
            # Run async send_message in a sync way
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(bot.send_message(chat_id=chat_id, text=text))
            loop.close()
            return True
        except Exception as e:
            print(f"Telegram send error: {e}")
            return False

    @staticmethod
    def send_notification(user, notification):
        """Send a notification object to user's Telegram."""
        if not user.telegram_chat_id:
            return False
            
        text = f"🔔 {notification.title}\n\n{notification.message}"
        success = TelegramService.send_message(user.telegram_chat_id, text)
        if success:
            notification.is_sent_telegram = True
            notification.save(update_fields=['is_sent_telegram'])
        return success
