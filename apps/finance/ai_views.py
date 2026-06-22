import urllib.request
import urllib.error
import json
import time
import re
from decimal import Decimal

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import MainBalance, Transaction, Savings, Loan


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


class AIChatView(APIView):
    """
    Backend proxy for Gemini AI chat.
    
    Xavfsizlik:
    - Har bir request autentifikatsiya talab qiladi
    - User faqat o'z moliyaviy ma'lumotlarini oladi
    - API key serverda xavfsiz saqlanadi
    - User o'z kalitini ham berishi mumkin (X-Gemini-Key header orqali)
    
    Ishonchlilik:
    - Retry mexanizmi bilan (exponential backoff)
    - Rate limit bo'lsa kutib qayta urinadi
    - Gemini ishlamasa, lokal fallback AI javob beradi
    """
    permission_classes = [IsAuthenticated]

    SYSTEM_PROMPT = """Sen professional moliyaviy maslahatchi AI botsisan. 
Foydalanuvchi shaxsiy moliyaviy ma'lumotlari asosida tahlil qilib, tushunarli va aniq maslahatlar berasan.
Javoblarni qisqa, aniq va foydali qilib ber. O'zbek tilida yoz. Emoji ishlatishing mumkin.
Foydalanuvchi xarajatlari, daromadlari, qarzlari va jamg'armalari haqida suraydi — shu ma'lumotlar asosida javob ber.
Salbiy balans yoki ortiqcha xarajat bo'lsa, muloyimlik bilan ogohlantir."""

    # Gemini API modellar (birinchisi ishlamasa keyingisi ishlatiladi)
    GEMINI_MODELS = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
    ]

    MAX_RETRIES = 3
    INITIAL_BACKOFF = 1  # sekund

    def _get_user_financial_context(self, user):
        """User uchun moliyaviy ma'lumotlarni yig'ib kontekst yaratadi."""
        from django.utils import timezone
        from django.db.models import Sum
        
        now = timezone.now().date()
        month_start = now.replace(day=1)
        
        # Main balance
        balance, _ = MainBalance.objects.get_or_create(user=user)
        
        # Bu oygi tranzaksiyalar
        month_txs = Transaction.objects.filter(
            user=user, date__gte=month_start, is_deleted=False
        ).select_related('category')
        
        monthly_income = month_txs.filter(type='INCOME').aggregate(
            total=Sum('amount'))['total'] or Decimal('0')
        monthly_expense = month_txs.filter(type='EXPENSE').aggregate(
            total=Sum('amount'))['total'] or Decimal('0')
        
        # Kategoriyalar bo'yicha xarajatlar
        category_stats = {}
        for tx in month_txs.filter(type='EXPENSE'):
            cat_name = tx.category.name if tx.category else 'Boshqa'
            category_stats[cat_name] = category_stats.get(cat_name, Decimal('0')) + tx.amount
        
        top_categories = sorted(category_stats.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Jamg'armalar
        savings = Savings.objects.filter(user=user, is_deleted=False).prefetch_related('goals')
        pool_total = sum(s.current_amount for s in savings)
        goals_total = sum(
            g.current_amount for s in savings for g in s.goals.filter(is_deleted=False)
        )
        
        goals_info = []
        for s in savings:
            for g in s.goals.filter(is_deleted=False):
                pct = round(float(g.current_amount) / float(g.target_amount) * 100) if g.target_amount > 0 else 0
                goals_info.append({
                    'name': g.name,
                    'current': float(g.current_amount),
                    'target': float(g.target_amount),
                    'percent': pct,
                    'status': g.status
                })
        
        # Qarzlar
        loans = Loan.objects.filter(user=user, is_deleted=False, status='ACTIVE')
        my_debt = sum(l.remaining_amount for l in loans.filter(direction='INCOMING'))
        owed_me = sum(l.remaining_amount for l in loans.filter(direction='OUTGOING'))
        
        # O'tgan oy va joriy oy tranzaksiyalari (Oylik tahlil va rejalashtirish uchun)
        import datetime
        last_month_start = (month_start - datetime.timedelta(days=1)).replace(day=1)
        
        recent_txs = Transaction.objects.filter(
            user=user, date__gte=last_month_start, is_deleted=False
        ).select_related('category').order_by('-date', '-created_at')
        
        recent_list = []
        for t in recent_txs:
            recent_list.append(f"  {t.date} | {'+'if t.type=='INCOME' else '-'}{float(t.amount):,.0f} so'm | {t.category.name if t.category else t.type}{' | '+t.note if t.note else ''}")
        
        savings_rate = round((float(monthly_income - monthly_expense) / float(monthly_income) * 100), 1) if monthly_income > 0 else 0
        
        context_lines = [
            f"FOYDALANUVCHI: {user.full_name}",
            "=" * 40,
            f"💰 Asosiy balans: {float(balance.total_amount):,.0f} so'm",
            f"📈 Bu oygi daromad: {float(monthly_income):,.0f} so'm",
            f"📉 Bu oygi xarajat: {float(monthly_expense):,.0f} so'm",
            f"💹 Tejamkorlik: {savings_rate}%",
            f"🎯 Jamg'arma (asosiy): {float(pool_total):,.0f} so'm",
            f"🏹 Maqsadlarga yo'naltirilgan: {float(goals_total):,.0f} so'm",
            f"🔴 Qarzlarim: {float(my_debt):,.0f} so'm",
            f"🟢 Menga berishlari: {float(owed_me):,.0f} so'm",
            "",
            "📊 Xarajatlar taqsimoti (bu oy):",
        ]
        
        if top_categories:
            for name, val in top_categories:
                context_lines.append(f"  - {name}: {float(val):,.0f} so'm")
        else:
            context_lines.append("  Ma'lumot yo'q")
        
        context_lines.append("\n🎯 Maqsadlar:")
        if goals_info:
            for g in goals_info:
                context_lines.append(f"  - {g['name']}: {g['current']:,.0f}/{g['target']:,.0f} so'm ({g['percent']}%)")
        else:
            context_lines.append("  Maqsadlar yo'q")
        
        context_lines.append("\n📋 O'tgan va joriy oylik tranzaksiyalar (Chuqur tahlil uchun):")
        if recent_list:
            context_lines.extend(recent_list)
        else:
            context_lines.append("  Ma'lumot yo'q")
        
        context_lines.append("=" * 40)
        
        return "\n".join(context_lines)

    def _call_gemini_api(self, api_key, gemini_contents, model_name):
        """Gemini API ga so'rov yuboradi. Muvaffaqiyatsiz bo'lsa exception tashlaydi."""
        payload = json.dumps({
            'contents': gemini_contents,
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 1024,
            }
        }, cls=DecimalEncoder).encode('utf-8')
        
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}'
        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            response_data = json.loads(resp.read().decode('utf-8'))
        
        ai_text = (
            response_data
            .get('candidates', [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', '')
        )
        return ai_text

    def _call_gemini_with_retry(self, api_key, gemini_contents):
        """
        Gemini API ni retry bilan chaqiradi.
        - Har bir model uchun MAX_RETRIES marta urinadi
        - 429 (rate limit) xatosida exponential backoff bilan kutadi
        - Bitta model ishlamasa, keyingisiga o'tadi
        """
        last_error = None
        
        for model_name in self.GEMINI_MODELS:
            for attempt in range(self.MAX_RETRIES):
                try:
                    ai_text = self._call_gemini_api(api_key, gemini_contents, model_name)
                    if ai_text:
                        return ai_text, model_name
                except urllib.error.HTTPError as e:
                    last_error = e
                    error_body = ''
                    try:
                        error_body = e.read().decode('utf-8')
                    except Exception:
                        pass
                    
                    if e.code == 429:
                        # Rate limit — kutib qayta urinish
                        wait_time = self.INITIAL_BACKOFF * (2 ** attempt)
                        time.sleep(wait_time)
                        continue
                    elif e.code == 404:
                        # Model topilmadi — keyingi modelga o'tish
                        break
                    elif e.code == 403:
                        # API key noto'g'ri — boshqa modelda ham ishlamaydi
                        raise e
                    else:
                        # Boshqa xatolik — qayta urinish
                        if attempt < self.MAX_RETRIES - 1:
                            time.sleep(self.INITIAL_BACKOFF)
                            continue
                        raise e
                except urllib.error.URLError as e:
                    last_error = e
                    if attempt < self.MAX_RETRIES - 1:
                        time.sleep(self.INITIAL_BACKOFF)
                        continue
                    raise e
        
        # Hech bir model ishlamadi
        if last_error:
            raise last_error
        return None, None

    def _generate_local_response(self, message, financial_context):
        """
        Gemini API ishlamasa, moliyaviy ma'lumotlar asosida 
        oddiy lokal javob generatsiya qiladi.
        """
        # Moliyaviy ma'lumotlarni parse qilish
        data = {}
        for line in financial_context.split('\n'):
            if 'Asosiy balans:' in line:
                data['balance'] = self._extract_number(line)
            elif 'Bu oygi daromad:' in line:
                data['income'] = self._extract_number(line)
            elif 'Bu oygi xarajat:' in line:
                data['expense'] = self._extract_number(line)
            elif 'Tejamkorlik:' in line:
                data['savings_rate'] = self._extract_number(line)
            elif "Jamg'arma (asosiy):" in line:
                data['savings'] = self._extract_number(line)
            elif 'Qarzlarim:' in line:
                data['debt'] = self._extract_number(line)
            elif 'Menga berishlari:' in line:
                data['owed'] = self._extract_number(line)

        msg_lower = message.lower()
        
        # Xarajatlar tahlili
        if any(word in msg_lower for word in ['xarajat', 'sarf', 'expense', 'xarajatlarim']):
            return self._expense_analysis(data, financial_context)
        
        # Tejash maslahat
        elif any(word in msg_lower for word in ['teja', 'saving', 'iqtisod', "ko'proq"]):
            return self._savings_advice(data)
        
        # Jamg'arma
        elif any(word in msg_lower for word in ["jamg'arma", 'strategiya', 'saving', 'maqsad']):
            return self._savings_strategy(data)
        
        # Moliyaviy sog'liq
        elif any(word in msg_lower for word in ["sog'liq", 'holat', 'baho', 'umumiy', 'status']):
            return self._financial_health(data)
        
        # Qarz
        elif any(word in msg_lower for word in ['qarz', 'loan', 'debt', 'borrow']):
            return self._debt_analysis(data)
        
        # Balans
        elif any(word in msg_lower for word in ['balans', 'balance', "pul", "qancha"]):
            return self._balance_info(data)
        
        # Umumiy javob
        else:
            return self._general_response(data)

    def _extract_number(self, text):
        """Matndan sonni oladi."""
        nums = re.findall(r'[\d,]+\.?\d*', text.replace(',', ''))
        if nums:
            try:
                return float(nums[0])
            except ValueError:
                return 0
        return 0

    def _expense_analysis(self, data, context):
        expense = data.get('expense', 0)
        income = data.get('income', 0)
        ratio = (expense / income * 100) if income > 0 else 0
        
        # Kategoriyalarni topish
        categories = []
        in_categories = False
        for line in context.split('\n'):
            if 'Xarajatlar taqsimoti' in line:
                in_categories = True
                continue
            if in_categories and line.strip().startswith('- '):
                categories.append(line.strip())
            elif in_categories and not line.strip().startswith('- ') and line.strip():
                in_categories = False
        
        response = f"📊 **Xarajatlar tahlili:**\n\n"
        response += f"Bu oy jami xarajatingiz: **{expense:,.0f} so'm**\n"
        response += f"Daromadingizning **{ratio:.1f}%** ini sarflayapsiz.\n\n"
        
        if categories:
            response += "📋 Eng katta xarajat kategoriyalari:\n"
            for cat in categories[:5]:
                response += f"  {cat}\n"
            response += "\n"
        
        if ratio > 80:
            response += "⚠️ Diqqat! Xarajatlaringiz daromadingizning 80% dan oshib ketgan. Ortiqcha xarajatlarni qisqartirishni maslahat beraman.\n"
        elif ratio > 60:
            response += "💡 Xarajatlaringiz o'rtacha darajada. Biroz tejash imkoniyatlari bor.\n"
        else:
            response += "✅ Ajoyib! Xarajatlaringiz nazorat ostida. Davom eting!\n"
        
        return response

    def _savings_advice(self, data):
        income = data.get('income', 0)
        expense = data.get('expense', 0)
        savings_rate = data.get('savings_rate', 0)
        
        response = "💡 **Tejash bo'yicha tavsiyalar:**\n\n"
        
        if income > 0:
            free_money = income - expense
            response += f"Bu oyda sarflanmagan pullingiz: **{free_money:,.0f} so'm**\n"
            response += f"Tejamkorlik darajangiz: **{savings_rate}%**\n\n"
        
        response += "🎯 Maslahatlar:\n\n"
        response += "1️⃣ **50/30/20 qoidasi:** Daromadingizning 50% zaruriy xarajatlarga, 30% shaxsiy xohishlarga, 20% jamg'armaga ajrating.\n\n"
        
        if savings_rate < 10:
            response += "2️⃣ ⚠️ Tejamkorlik darajangiz past. Avval kichik summalardan boshlang — har oyda kamida daromadingizning 10% ini tejashga harakat qiling.\n\n"
        elif savings_rate < 20:
            response += "2️⃣ 👍 Yaxshi boshlanish! 20% ga yetkazishga harakat qiling.\n\n"
        else:
            response += "2️⃣ ✅ Tejamkorlik darajangiz ajoyib! Shu yo'nalishda davom eting.\n\n"
        
        response += "3️⃣ Har oyning boshida avval jamg'armaga pul ajrating, keyin xarajatlarni rejalashtiring.\n"
        response += "4️⃣ Kundalik mayda xarajatlarni (kofe, taksi) kuzating — ular yig'ilib katta summa bo'ladi.\n"
        
        return response

    def _savings_strategy(self, data):
        savings = data.get('savings', 0)
        income = data.get('income', 0)
        
        response = "🎯 **Jamg'arma strategiyasi:**\n\n"
        response += f"Hozirgi jamg'armangiz: **{savings:,.0f} so'm**\n\n"
        
        response += "📌 Tavsiya etiladigan strategiya:\n\n"
        response += "1️⃣ **Favqulodda fond:** 3-6 oylik xarajatlaringizga teng summa to'plang. Bu moliyaviy xavfsizlik uchun juda muhim.\n\n"
        response += "2️⃣ **Maqsadli jamg'arma:** Aniq maqsadlar belgilang (mashina, uy, ta'til) va har biriga alohida summa ajrating.\n\n"
        response += "3️⃣ **Avtomatik tejash:** Oylik ish haqi kelgandan keyin avtomatik ravishda belgilangan summani jamg'armangizga o'tkazing.\n\n"
        
        if income > 0:
            recommended = income * 0.2
            response += f"4️⃣ Sizning daromadingiz asosida oyiga kamida **{recommended:,.0f} so'm** jamg'arishni tavsiya qilaman.\n"
        
        return response

    def _financial_health(self, data):
        balance = data.get('balance', 0)
        income = data.get('income', 0)
        expense = data.get('expense', 0)
        savings = data.get('savings', 0)
        debt = data.get('debt', 0)
        savings_rate = data.get('savings_rate', 0)
        
        score = 0
        details = []
        
        # Balans tekshirish
        if balance > 0:
            score += 20
            details.append("✅ Balansingiz ijobiy")
        else:
            details.append("❌ Balansingiz salbiy — diqqat talab etiladi")
        
        # Tejamkorlik
        if savings_rate >= 20:
            score += 25
            details.append("✅ Ajoyib tejamkorlik darajasi")
        elif savings_rate >= 10:
            score += 15
            details.append("⚠️ Tejamkorlik o'rtacha — oshirishga harakat qiling")
        else:
            score += 5
            details.append("❌ Tejamkorlik past — 20% ga yetkazish kerak")
        
        # Qarz tekshirish
        if debt == 0:
            score += 25
            details.append("✅ Qarzingiz yo'q — ajoyib!")
        elif income > 0 and debt < income * 3:
            score += 15
            details.append("⚠️ Qarzingiz boshqaruv ostida")
        else:
            score += 5
            details.append("❌ Qarz darajasi yuqori")
        
        # Jamg'arma
        if savings > 0:
            if income > 0 and savings >= income * 3:
                score += 30
                details.append("✅ Kuchli favqulodda fondi bor")
            else:
                score += 15
                details.append("⚠️ Jamg'arma bor, lekin favqulodda fond to'ldirish kerak")
        else:
            details.append("❌ Jamg'arma yo'q — bugun boshlang!")
        
        # Ball asosida emoji va daraja
        if score >= 80:
            grade = "🟢 A'lo"
        elif score >= 60:
            grade = "🟡 Yaxshi"
        elif score >= 40:
            grade = "🟠 O'rtacha"
        else:
            grade = "🔴 Yomon"
        
        response = f"🏥 **Moliyaviy sog'liq bahosi: {score}/100 — {grade}**\n\n"
        response += "📋 Batafsil tahlil:\n\n"
        for d in details:
            response += f"  {d}\n"
        
        response += f"\n📊 Asosiy ko'rsatkichlar:\n"
        response += f"  💰 Balans: {balance:,.0f} so'm\n"
        response += f"  📈 Oylik daromad: {income:,.0f} so'm\n"
        response += f"  📉 Oylik xarajat: {expense:,.0f} so'm\n"
        response += f"  🎯 Jamg'arma: {savings:,.0f} so'm\n"
        response += f"  🔴 Qarz: {debt:,.0f} so'm\n"
        
        return response

    def _debt_analysis(self, data):
        debt = data.get('debt', 0)
        owed = data.get('owed', 0)
        income = data.get('income', 0)
        
        response = "💳 **Qarz tahlili:**\n\n"
        response += f"🔴 Sizning qarzingiz: **{debt:,.0f} so'm**\n"
        response += f"🟢 Sizga qarzdorlar: **{owed:,.0f} so'm**\n\n"
        
        if debt == 0 and owed == 0:
            response += "✅ Hech qanday faol qarz yo'q. Ajoyib holat!\n"
        elif debt > 0:
            if income > 0:
                months_to_pay = debt / (income * 0.2) if income * 0.2 > 0 else float('inf')
                response += f"💡 Daromadingizning 20% ini qarz to'lashga ajratangiz, taxminan **{months_to_pay:.1f} oy** da qarzdan xalos bo'lishingiz mumkin.\n\n"
            response += "📌 Tavsiyalar:\n"
            response += "1️⃣ Avval eng kichik qarzlarni yoping (snowball metodi)\n"
            response += "2️⃣ Yangi qarz olmang\n"
            response += "3️⃣ Har oy belgilangan summadan ko'proq to'lang\n"
        
        return response

    def _balance_info(self, data):
        balance = data.get('balance', 0)
        income = data.get('income', 0)
        expense = data.get('expense', 0)
        savings = data.get('savings', 0)
        
        response = "💰 **Moliyaviy holatingiz:**\n\n"
        response += f"Asosiy balans: **{balance:,.0f} so'm**\n"
        response += f"Bu oygi daromad: **{income:,.0f} so'm**\n"
        response += f"Bu oygi xarajat: **{expense:,.0f} so'm**\n"
        response += f"Jamg'arma: **{savings:,.0f} so'm**\n"
        response += f"Jami boylik: **{balance + savings:,.0f} so'm**\n"
        
        return response

    def _general_response(self, data):
        balance = data.get('balance', 0)
        income = data.get('income', 0)
        expense = data.get('expense', 0)
        savings_rate = data.get('savings_rate', 0)
        
        response = "👋 Sizning moliyaviy holatlaringiz haqida qisqa ma'lumot:\n\n"
        response += f"💰 Balans: **{balance:,.0f} so'm**\n"
        response += f"📈 Bu oy daromad: **{income:,.0f} so'm**\n"
        response += f"📉 Bu oy xarajat: **{expense:,.0f} so'm**\n"
        response += f"💹 Tejamkorlik: **{savings_rate}%**\n\n"
        response += "Quyidagi mavzulardan birini tanlashingiz mumkin:\n"
        response += "• 📊 \"Xarajatlarimni tahlil qil\"\n"
        response += "• 💡 \"Tejash bo'yicha maslahat\"\n"
        response += "• 🎯 \"Jamg'arma strategiyasi\"\n"
        response += "• 🏥 \"Moliyaviy sog'liq\"\n"
        response += "• 💳 \"Qarz tahlili\"\n"
        
        return response

    def post(self, request):
        """
        POST /api/finance/ai-chat/
        Body: { "message": "...", "history": [...] }
        Header (ixtiyoriy): X-Gemini-Key: user_custom_key
        """
        message = request.data.get('message', '').strip()
        history = request.data.get('history', [])  # [{role, content}, ...]
        
        if not message:
            return Response({'error': 'Xabar bo\'sh'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Faqat user o'zi bergan kalitni ishlatamiz.
        # Agar server GEMINI_API_KEY ni ham qo'llab-quvvatlashi kerak bo'lsa,
        # .env ga GEMINI_API_KEY qo'shing — bo'sh bo'lsa lokal AI ishlaydi.
        user_key = request.META.get('HTTP_X_GEMINI_KEY', '').strip()
        server_key = getattr(settings, 'GEMINI_API_KEY', '').strip()
        
        # User kaliti ustunlik qiladi; yo'q bo'lsa server kaliti (ixtiyoriy); ikkalasi ham yo'q — lokal AI
        api_key = user_key or server_key
        
        # User moliyaviy kontekstini olish
        try:
            financial_context = self._get_user_financial_context(request.user)
        except Exception as e:
            financial_context = "Ma'lumotlar yuklanmadi"
        
        # Suhbat tarixini formatlash
        gemini_contents = []
        for msg in history[-10:]:  # oxirgi 10 ta xabar
            role = 'model' if msg.get('role') == 'assistant' else 'user'
            gemini_contents.append({
                'role': role,
                'parts': [{'text': msg.get('content', '')}]
            })
        
        # Joriy xabarni kontekst bilan yuborish
        full_prompt = f"{self.SYSTEM_PROMPT}\n\n{financial_context}\n\nFoydalanuvchi savoli: {message}"
        gemini_contents.append({
            'role': 'user',
            'parts': [{'text': full_prompt}]
        })
        
        # === Gemini API ni ishlatishga urinish ===
        if api_key and api_key != 'YOUR_GEMINI_API_KEY_HERE':
            try:
                ai_text, model_used = self._call_gemini_with_retry(api_key, gemini_contents)
                
                if ai_text:
                    return Response({
                        'reply': ai_text,
                        'source': 'gemini',
                        'model': model_used,
                        'using_default_key': not bool(user_key),
                    })
            
            except urllib.error.HTTPError as e:
                error_body = ''
                try:
                    error_body = e.read().decode('utf-8')
                except Exception:
                    pass
                
                if e.code == 403:
                    # API key noto'g'ri — lokal javobga o'tish
                    pass
                elif e.code == 429:
                    # Rate limit — lokal javobga o'tish
                    pass  
                else:
                    # Boshqa xatolik — lokal javobga o'tish
                    pass
            
            except Exception as e:
                # Har qanday xatolik — lokal javobga o'tish
                pass
        
        # === Fallback: Lokal AI javob ===
        try:
            local_reply = self._generate_local_response(message, financial_context)
            
            return Response({
                'reply': local_reply,
                'source': 'local',
                'model': 'local-finance-ai',
                'using_default_key': False,
                'note': 'Gemini API hozirda ishlamayapti. Lokal tahlil natijasi ko\'rsatilmoqda.'
            })
        except Exception as e:
            return Response(
                {'error': f'Server xatolik: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
