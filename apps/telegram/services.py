import asyncio
import io
from telegram import Bot
from django.conf import settings


class TelegramService:
    """Service to send messages and documents to users via Telegram bot."""

    @staticmethod
    def _get_bot():
        """Get bot instance."""
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        if not token or token == "YOUR_BOT_TOKEN":
            return None
        return Bot(token=token)

    @staticmethod
    def _run_async(coro):
        """Run async coroutine in sync context."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is already running (e.g., in Django), create a new one
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, coro)
                    return future.result()
            else:
                return loop.run_until_complete(coro)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()

    @staticmethod
    def send_message(chat_id, text, parse_mode=None):
        """Send a simple text message."""
        bot = TelegramService._get_bot()
        if not bot or not chat_id:
            return False

        try:
            TelegramService._run_async(
                bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
            )
            return True
        except Exception as e:
            print(f"Telegram send error: {e}")
            return False

    @staticmethod
    def send_document(chat_id, document, filename, caption=None):
        """Send a document (e.g., Excel file)."""
        bot = TelegramService._get_bot()
        if not bot or not chat_id:
            return False

        try:
            TelegramService._run_async(
                bot.send_document(
                    chat_id=chat_id,
                    document=document,
                    filename=filename,
                    caption=caption
                )
            )
            return True
        except Exception as e:
            print(f"Telegram document send error: {e}")
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
