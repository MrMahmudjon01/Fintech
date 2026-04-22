import logging
import io
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ConversationHandler,
)
from asgiref.sync import sync_to_async
from django.conf import settings
from apps.users.models import User
from apps.finance.models import MainBalance, Savings, Loan, Transaction
from apps.analytics.reports import MainBalanceReport, SavingsReport, LoanReport, GlobalReport
from apps.analytics.exports import export_weekly_balance, export_monthly_all, export_yearly_all

# Enable logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
PHONE, OPT = range(2)

# Keyboard button texts
KEYBOARD_TEXTS = [
    "💰 Balans",
    "🎯 Jamg'armalar",
    "💳 Qarzlar",
    "📊 Umumiy holat",
    "📈 Haftalik hisobot",
    "📥 Excel hisobotlar",
    "📋 Oxirgi tranzaksiyalar",
]


@sync_to_async
def get_user_by_telegram(user_id):
    """Get user by telegram chat ID."""
    try:
        return User.objects.get(telegram_chat_id=str(user_id))
    except User.DoesNotExist:
        return None

@sync_to_async
def get_user_by_phone(phone):
    try:
        return User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        return None

@sync_to_async
def get_user_by_id(user_id):
    return User.objects.get(id=user_id)

@sync_to_async
def check_password_async(user, password):
    return user.check_password(password)

@sync_to_async
def save_user_async(user, telegram_id):
    user.telegram_chat_id = str(telegram_id)
    user.save()


# ─────────────────────────────────────────────────────────
# AUTHENTICATION
# ─────────────────────────────────────────────────────────

def get_main_keyboard():
    return ReplyKeyboardMarkup([
        ["💰 Balans", "🎯 Jamg'armalar"],
        ["💳 Qarzlar", "📊 Umumiy holat"],
        ["📈 Haftalik hisobot", "📥 Excel hisobotlar"],
        ["📋 Oxirgi tranzaksiyalar"]
    ], resize_keyboard=True)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command: Welcome and account linking."""
    user = await get_user_by_telegram(update.effective_user.id)
    if user:
        await update.message.reply_text(
            f"Salom {user.full_name}! 👋\n\n"
            f"Fintech botiga xush kelibsiz.\n\n"
            f"Tugmalardan tanlang yoki buyruq kiriting.",
            reply_markup=get_main_keyboard()
        )
        return ConversationHandler.END
    else:
        await update.message.reply_text(
            "Salom! 👋\nHisobingizni ulash uchun telefon raqamingizni yuboring\n"
            "(masalan: +998901234567)."
        )
        return PHONE


async def handle_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle phone number for linking."""
    phone = update.message.text.strip()

    # Ignore keyboard button texts during PHONE state
    if phone in KEYBOARD_TEXTS:
        await update.message.reply_text(
            "Iltimos, avval telefon raqamingizni kiriting:\n(masalan: +998901234567)"
        )
        return PHONE

    context.user_data['phone'] = phone

    try:
        user = await get_user_by_phone(phone)
        context.user_data['user_id'] = user.id
        await update.message.reply_text(
            f"Hisob topildi: {user.full_name}.\n"
            f"Tasdiqlash uchun parolingizni yuboring."
        )
        return OPT
    except Exception:
        await update.message.reply_text(
            "Ushbu raqam bilan ro'yxatdan o'tilmagan.\n"
            "Iltimos, raqamni qayta tekshiring yoki qaytadan kiriting:"
        )
        return PHONE


async def handle_password(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Verify password and link Telegram."""
    password = update.message.text
    user_id = context.user_data.get('user_id')

    if not user_id:
        await update.message.reply_text("Xatolik. /start buyrug'ini qaytadan bosing.")
        return ConversationHandler.END

    user = await get_user_by_id(user_id)
    if await check_password_async(user, password):
        await save_user_async(user, update.effective_user.id)

        # Delete the password message for security
        try:
            await update.message.delete()
        except Exception:
            pass

        await update.message.reply_text(
            "✅ Muvaffaqiyatli ulandi!\n\n"
            "Endi barcha moliyaviy ma'lumotlaringizni shu yerda ko'rishingiz mumkin.",
            reply_markup=get_main_keyboard()
        )
        return ConversationHandler.END
    else:
        await update.message.reply_text("❌ Xato parol. Qayta urinib ko'ring.")
        return OPT


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation."""
    await update.message.reply_text(
        "Bekor qilindi.",
        reply_markup=get_main_keyboard()
    )
    return ConversationHandler.END


# ─────────────────────────────────────────────────────────
# BALANCE
# ─────────────────────────────────────────────────────────

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View main balance with weekly change."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text(
            "❗ Hisobingiz ulanmagan.\n\n"
            "Ulash uchun /start buyrug'ini bosing va telefon raqamingizni kiriting."
        )
        return

    try:
        acc, _ = await sync_to_async(MainBalance.objects.get_or_create)(user=user)
        weekly_change = acc.total_amount - acc.weekly_start_amount

        text = (
            f"💰 *Asosiy Balans*\n\n"
            f"Joriy balans: *{acc.total_amount:,.2f} so'm*\n"
            f"Hafta boshi: {acc.weekly_start_amount:,.2f} so'm\n"
            f"Haftalik o'zgarish: {'📈' if weekly_change >= 0 else '📉'} "
            f"{weekly_change:+,.2f} so'm"
        )
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Balance error: {e}")
        await update.message.reply_text("❌ Ma'lumot olishda xatolik yuz berdi.")


# ─────────────────────────────────────────────────────────
# SAVINGS
# ─────────────────────────────────────────────────────────

def _get_savings_text(user):
    savings_list = list(Savings.objects.filter(user=user, is_deleted=False).prefetch_related('goals'))
    if not savings_list:
        return "📭 Sizda jamg'armalar yo'q."

    pool_total = sum(s.current_amount for s in savings_list)
    goals_total = sum(
        g.current_amount
        for s in savings_list
        for g in s.goals.filter(is_deleted=False)
    )
    grand_total = pool_total + goals_total

    text = (
        f"🎯 *Asosiy Jamg'arma*\n\n"
        f"💵 Jami jamg'arma: *{grand_total:,.2f} so'm*\n"
        f"   • Asosiy jamg'arma: *{pool_total:,.2f} so'm*\n"
        f"   • Maqsadlarga yo'naltirilgan: *{goals_total:,.2f} so'm*\n\n"
    )

    for s in savings_list:
        status_icon = '✅' if s.status == 'COMPLETED' else '🔄'
        target_text = f"/ {s.target_amount:,.0f}" if s.target_amount else "/ ∞"
        text += (
            f"{status_icon} *{s.name}*\n"
            f"   💵 {s.current_amount:,.2f} {target_text} so'm"
            f" ({s.progress_percent}%)\n"
        )
        active_goals = s.goals.filter(is_deleted=False)
        if active_goals.exists():
            for g in active_goals:
                g_percent = min(100, round((g.current_amount / g.target_amount) * 100)) if g.target_amount > 0 else 0
                g_icon = '✅' if g.status == 'COMPLETED' else '🎯'
                text += (
                    f"   {g_icon} {g.name}: {g.current_amount:,.0f}"
                    f"/{g.target_amount:,.0f} ({g_percent}%)\n"
                )
        text += "\n"
    return text

async def savings_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View all savings accounts with goals."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text("❗ Avval hisobingizni ulang: /start")
        return

    try:
        text = await sync_to_async(_get_savings_text)(user)
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Savings error: {e}")
        await update.message.reply_text("❌ Ma'lumot olishda xatolik yuz berdi.")


# ─────────────────────────────────────────────────────────
# LOANS
# ─────────────────────────────────────────────────────────

def _get_loans_text(user):
    loans_all = list(Loan.objects.filter(user=user, is_deleted=False))
    if not loans_all:
        return "📭 Sizda qarzlar yo'q."

    active_incoming = [l for l in loans_all if l.direction == 'INCOMING' and l.status == 'ACTIVE']
    active_outgoing = [l for l in loans_all if l.direction == 'OUTGOING' and l.status == 'ACTIVE']
    settled_count = sum(1 for l in loans_all if l.status == 'SETTLED')

    total_my_debt = sum(l.remaining_amount for l in active_incoming)
    total_owed_me = sum(l.remaining_amount for l in active_outgoing)

    text = (
        f"💳 *Qarzlar*\n\n"
        f"🔴 Mening qarzlarim: *{total_my_debt:,.2f} so'm*\n"
        f"🟢 Menga qarzi: *{total_owed_me:,.2f} so'm*\n"
        f"✅ To'langan: {settled_count} ta\n\n"
    )

    if active_incoming:
        text += "━━━ *Qarz oldim* ━━━\n"
        for l in active_incoming:
            due = f" ⏰ {l.due_date}" if l.due_date else ""
            text += (
                f"• {l.person_name}: {l.remaining_amount:,.0f} so'm"
                f" ({l.repayment_percent}% to'langan){due}\n"
            )
        text += "\n"

    if active_outgoing:
        text += "━━━ *Qarz berdim* ━━━\n"
        for l in active_outgoing:
            due = f" ⏰ {l.due_date}" if l.due_date else ""
            text += (
                f"• {l.person_name}: {l.remaining_amount:,.0f} so'm"
                f" ({l.repayment_percent}% to'langan){due}\n"
            )
        text += "\n"
    return text

async def loans_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View all loans."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text("❗ Avval hisobingizni ulang: /start")
        return

    try:
        text = await sync_to_async(_get_loans_text)(user)
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Loans error: {e}")
        await update.message.reply_text("❌ Ma'lumot olishda xatolik yuz berdi.")


# ─────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────

def _get_summary_text(user):
    acc, _ = MainBalance.objects.get_or_create(user=user)

    savings_qs = list(Savings.objects.filter(user=user, is_deleted=False).prefetch_related('goals'))
    pool_savings = sum(s.current_amount for s in savings_qs)
    goal_savings = sum(
        g.current_amount
        for s in savings_qs
        for g in s.goals.filter(is_deleted=False)
    )
    total_savings = pool_savings + goal_savings

    active_loans = list(Loan.objects.filter(user=user, is_deleted=False, status='ACTIVE'))
    my_debt = sum(l.remaining_amount for l in active_loans if l.direction == 'INCOMING')
    owed_me = sum(l.remaining_amount for l in active_loans if l.direction == 'OUTGOING')

    net_worth = acc.total_amount + total_savings + owed_me - my_debt

    text = (
        f"📊 *Umumiy Moliyaviy Holat*\n\n"
        f"💰 Asosiy balans: *{acc.total_amount:,.2f} so'm*\n"
        f"🎯 Asosiy jamg'arma: *{pool_savings:,.2f} so'm*\n"
        f"🏹 Maqsadlarga yo'naltirilgan: *{goal_savings:,.2f} so'm*\n"
        f"📦 Jami jamg'arma: *{total_savings:,.2f} so'm*\n"
        f"🔴 Qarzlarim: *{my_debt:,.2f} so'm*\n"
        f"🟢 Menga berishlari: *{owed_me:,.2f} so'm*\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🏦 *Umumiy boylik: {net_worth:,.2f} so'm*\n"
        f"_(Balans + Jamg'arma + Qarzdorlar - Qarzlar)_"
    )
    return text

async def summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Full financial summary."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text("❗ Avval hisobingizni ulang: /start")
        return

    try:
        text = await sync_to_async(_get_summary_text)(user)
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Summary error: {e}")
        await update.message.reply_text("❌ Ma'lumot olishda xatolik yuz berdi.")


# ─────────────────────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────────────────────

def _get_weekly_report_text(user):
    rep = MainBalanceReport.weekly(user)
    text = (
        f"📊 *Haftalik Hisobot*\n"
        f"_{rep['week_start']} — {rep['week_end']}_\n\n"
    )
    for day in rep['daily']:
        income = day['income']
        expense = day['expense']
        if income > 0 or expense > 0:
            text += f"📅 {day['day_name'][:3]} ({day['day']}):\n"
            if income > 0:
                text += f"   📈 +{income:,.0f}\n"
            if expense > 0:
                text += f"   📉 -{expense:,.0f}\n"

    text += (
        f"\n━━━ *JAMI* ━━━\n"
        f"📈 Daromad: *{rep['totals']['income']:,.2f} so'm*\n"
        f"📉 Xarajat: *{rep['totals']['expense']:,.2f} so'm*\n"
        f"💵 Sof: *{rep['totals']['net']:+,.2f} so'm*"
    )
    return text

async def report_weekly(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Weekly financial report."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text("❗ Avval hisobingizni ulang: /start")
        return

    try:
        text = await sync_to_async(_get_weekly_report_text)(user)
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Weekly report error: {e}")
        await update.message.reply_text("❌ Hisobot tayyorlashda xatolik yuz berdi.")


# ─────────────────────────────────────────────────────────
# EXCEL EXPORTS
# ─────────────────────────────────────────────────────────

async def export_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show export options."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text("❗ Avval hisobingizni ulang: /start")
        return

    keyboard = [
        [InlineKeyboardButton("📊 Haftalik Excel", callback_data="export_weekly")],
        [InlineKeyboardButton("📊 Oylik Excel", callback_data="export_monthly")],
        [InlineKeyboardButton("📊 Yillik Excel", callback_data="export_yearly")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "📥 *Excel hisobotlar*\n\nQaysi hisobotni yuklab olmoqchisiz?",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )


def _export_weekly(user):
    return export_weekly_balance(user)

def _export_monthly(user):
    from django.utils import timezone
    now = timezone.now()
    return export_monthly_all(user, now.year, now.month), now

def _export_yearly(user):
    from django.utils import timezone
    now = timezone.now()
    return export_yearly_all(user, now.year), now

async def handle_export_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle export button clicks."""
    query = update.callback_query
    await query.answer()

    user = await get_user_by_telegram(query.from_user.id)
    if not user:
        await query.edit_message_text("❗ Avval hisobingizni ulang: /start")
        return

    try:
        if query.data == "export_weekly":
            buffer, filename = await sync_to_async(_export_weekly)(user)
            await query.message.reply_document(
                document=buffer,
                filename=filename,
                caption="📊 Haftalik hisobot tayyor!"
            )

        elif query.data == "export_monthly":
            (buffer, filename), now = await sync_to_async(_export_monthly)(user)
            await query.message.reply_document(
                document=buffer,
                filename=filename,
                caption=f"📊 Oylik hisobot ({now.year}/{now.month:02d}) tayyor!"
            )

        elif query.data == "export_yearly":
            (buffer, filename), now = await sync_to_async(_export_yearly)(user)
            await query.message.reply_document(
                document=buffer,
                filename=filename,
                caption=f"📊 Yillik hisobot ({now.year}) tayyor!"
            )

        await query.edit_message_text("✅ Hisobot yuborildi!")

    except Exception as e:
        logger.error(f"Export error: {e}")
        await query.edit_message_text(f"❌ Xatolik yuz berdi")


# ─────────────────────────────────────────────────────────
# HELP
# ─────────────────────────────────────────────────────────

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show all available commands."""
    text = (
        "📋 *Mavjud buyruqlar:*\n\n"
        "/balance — 💰 Asosiy balansni ko'rish\n"
        "/savings — 🎯 Jamg'armalar va maqsadlar\n"
        "/loans — 💳 Barcha qarzlar\n"
        "/summary — 📊 Umumiy moliyaviy holat\n"
        "/report — 📈 Haftalik hisobot\n"
        "/export — 📥 Excel hisobotlar yuklab olish\n"
        "/help — ❓ Ushbu yordam\n\n"
        "_Bot faqat ko'rish rejimida ishlaydi.\n"
        "O'zgartirishlar uchun web ilovadan foydalaning._"
    )
    await update.message.reply_text(text, parse_mode='Markdown')


# ─────────────────────────────────────────────────────────
# RECENT TRANSACTIONS
# ─────────────────────────────────────────────────────────

def _get_transactions_text(user):
    txs = list(Transaction.objects.filter(
        user=user, is_deleted=False
    ).select_related('category').order_by('-date', '-created_at')[:15])

    if not txs:
        return "📭 Tranzaksiyalar yo'q."

    TYPE_EMOJI = {
        'INCOME': '📈', 'EXPENSE': '📉', 'SAVINGS_DEPOSIT': '🎯',
        'SAVINGS_WITHDRAW': '↩️', 'LOAN_IN': '💳+', 'LOAN_OUT': '💳-',
        'LOAN_REPAY': '🔄', 'TRANSFER': '⇄', 'SAVING': '🎯',
    }

    text = "📋 *Oxirgi 15 ta tranzaksiya:*\n\n"
    for t in txs:
        emoji = TYPE_EMOJI.get(t.type, '•')
        cat = t.category.name if t.category else ''
        note = f" — {t.note}" if t.note else ''
        text += (
            f"{emoji} {t.date} | {t.amount:,.0f} so'm"
            f"{(' | ' + cat) if cat else ''}{note}\n"
        )
    return text

async def transactions_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View recent transactions."""
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text("❗ Avval hisobingizni ulang: /start")
        return

    try:
        text = await sync_to_async(_get_transactions_text)(user)
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Transactions error: {e}")
        await update.message.reply_text("❌ Tranzaksiyalarni olishda xatolik yuz berdi.")


# ─────────────────────────────────────────────────────────
# KEYBOARD COMMANDS HANDLER
# ─────────────────────────────────────────────────────────

async def handle_keyboard_commands(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle reply keyboard button presses."""
    text = update.message.text

    # Check if user is authenticated
    user = await get_user_by_telegram(update.effective_user.id)
    if not user:
        await update.message.reply_text(
            "❗ Hisobingiz ulanmagan.\n\n"
            "Ulash uchun /start buyrug'ini bosing va telefon raqamingizni kiriting."
        )
        return

    dispatch = {
        "💰 Balans": balance,
        "🎯 Jamg'armalar": savings_cmd,
        "💳 Qarzlar": loans_cmd,
        "📊 Umumiy holat": summary,
        "📈 Haftalik hisobot": report_weekly,
        "📥 Excel hisobotlar": export_menu,
        "📋 Oxirgi tranzaksiyalar": transactions_cmd,
    }

    handler = dispatch.get(text)
    if handler:
        await handler(update, context)
    else:
        await update.message.reply_text(
            "❓ Noma'lum buyruq.\n\n"
            "Pastdagi tugmalardan foydalaning yoki /help ni kiriting.",
            reply_markup=get_main_keyboard()
        )


# ─────────────────────────────────────────────────────────
# BOT RUNNER
# ─────────────────────────────────────────────────────────

def run_bot():
    """Bot runner function."""
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    if not token or token == "YOUR_BOT_TOKEN":
        print("TELEGRAM_BOT_TOKEN sozlanmagan!")
        return

    app = ApplicationBuilder().token(token).build()

    # Authentication conversation handler — highest priority
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            PHONE: [MessageHandler(filters.TEXT & (~filters.COMMAND), handle_phone)],
            OPT: [MessageHandler(filters.TEXT & (~filters.COMMAND), handle_password)],
        },
        fallbacks=[
            CommandHandler("start", start),
            CommandHandler("cancel", cancel),
        ],
        allow_reentry=True,
        # This ensures ConversationHandler takes priority
        per_message=False,
    )

    # Register all handlers in the correct order
    app.add_handler(conv_handler)

    # Keyboard button handler — MUST come before unknown handler
    keyboard_filter = filters.Regex(
        "^(💰 Balans|🎯 Jamg'armalar|💳 Qarzlar|📊 Umumiy holat"
        "|📈 Haftalik hisobot|📥 Excel hisobotlar|📋 Oxirgi tranzaksiyalar)$"
    )
    app.add_handler(MessageHandler(keyboard_filter, handle_keyboard_commands))

    # Command handlers
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("savings", savings_cmd))
    app.add_handler(CommandHandler("loans", loans_cmd))
    app.add_handler(CommandHandler("summary", summary))
    app.add_handler(CommandHandler("report", report_weekly))
    app.add_handler(CommandHandler("export", export_menu))
    app.add_handler(CommandHandler("transactions", transactions_cmd))
    app.add_handler(CommandHandler("help", help_cmd))

    # Callback handler for export inline buttons
    app.add_handler(CallbackQueryHandler(handle_export_callback))

    print("✅ Telegram bot ishga tushdi...")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)
