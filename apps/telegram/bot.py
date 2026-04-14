import logging
import os
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
    ConversationHandler,
)
from django.conf import settings
from apps.users.models import User
from apps.finance.services import BalanceService, SavingsService, LoanService
from apps.analytics.reports import MainBalanceReport

# Enable logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
PHONE, OPT = range(2)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command: Welcome and account linking."""
    user_id = update.effective_user.id
    try:
        user = User.objects.get(telegram_chat_id=str(user_id))
        await update.message.reply_text(
            f"Salom {user.full_name}! 👋\nFintech botiga xush kelibsiz. Balansni ko'rish uchun /balance buyrug'ini bosing."
        )
        return ConversationHandler.END
    except User.DoesNotExist:
        await update.message.reply_text(
            "Salom! 👋\nHisobingizni ulash uchun telefon raqamingizni yuboring (masalan: +998901234567).",
        )
        return PHONE

async def handle_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle phone number for linking."""
    phone = update.message.text
    context.user_data['phone'] = phone
    
    try:
        user = User.objects.get(phone_number=phone)
        context.user_data['user_id'] = user.id
        await update.message.reply_text(
            f"Hisob topildi: {user.full_name}. Tasdiqlash uchun parolingizni yuboring."
        )
        return OPT
    except User.DoesNotExist:
        await update.message.reply_text("Ushbu raqam bilan ro'yxatdan o'tilmagan. Iltimos, raqamni qayta tekshiring.")
        return PHONE

async def handle_password(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Verify password and link Telegram."""
    password = update.message.text
    phone = context.user_data['phone']
    user_id = context.user_data['user_id']
    
    user = User.objects.get(id=user_id)
    if user.check_password(password):
        user.telegram_chat_id = str(update.effective_user.id)
        user.save()
        await update.message.reply_text("Muvaffaqiyatli ulandi! ✅ Endi bildirishnomalarni shu yerda olasiz.")
        return ConversationHandler.END
    else:
        await update.message.reply_text("Xato parol. Qayta urinib ko'ring.")
        return OPT

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View main balance."""
    user_id = update.effective_user.id
    try:
        user = User.objects.get(telegram_chat_id=str(user_id))
        acc = BalanceService.get_or_create(user)
        await update.message.reply_text(f"💰 Asosiy balans: {acc.total_amount:,.2f} so'm")
    except User.DoesNotExist:
        await update.message.reply_text("Iltimos, avval hisobingizni ulang: /start")

async def savings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View savings accounts."""
    user_id = update.effective_user.id
    try:
        user = User.objects.get(telegram_chat_id=str(user_id))
        savings_list = user.savings.all()
        if not savings_list:
            await update.message.reply_text("Sizda jamg'armalar yo'q.")
            return
        
        text = "🎯 Jamg'armalar:\n"
        for s in savings_list:
            text += f"- {s.name}: {s.current_amount:,.2f} / {s.target_amount or '∞'} so'm ({s.progress_percent}%)\n"
        await update.message.reply_text(text)
    except User.DoesNotExist:
        await update.message.reply_text("Iltimos, avval hisobingizni ulang: /start")

async def report_weekly(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Weekly report."""
    user_id = update.effective_user.id
    try:
        user = User.objects.get(telegram_chat_id=str(user_id))
        rep = MainBalanceReport.weekly(user)
        text = f"📊 Haftalik hisobot ({rep['week_start']} - {rep['week_end']}):\n\n"
        text += f"📈 Daromad: {rep['totals']['income']:,.2f} so'm\n"
        text += f"📉 Xarajat: {rep['totals']['expense']:,.2f} so'm\n"
        text += f"💵 Sof foyda: {rep['totals']['net']:,.2f} so'm"
        await update.message.reply_text(text)
    except User.DoesNotExist:
        await update.message.reply_text("Iltimos, avval hisobingizni ulang: /start")

def run_bot():
    """Bot runner function."""
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    if not token or token == "YOUR_BOT_TOKEN":
        print("TELEGRAM_BOT_TOKEN sozlanmagan!")
        return

    app = ApplicationBuilder().token(token).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            PHONE: [MessageHandler(filters.TEXT & (~filters.COMMAND), handle_phone)],
            OPT: [MessageHandler(filters.TEXT & (~filters.COMMAND), handle_password)],
        },
        fallbacks=[CommandHandler("start", start)],
    )

    app.add_handler(conv_handler)
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("savings", savings))
    app.add_handler(CommandHandler("report", report_weekly))

    print("Bot ishga tushdi...")
    app.run_polling()
