# KURS ISHI / LОYIHА HISOBOTI

**Mavzu:** "Shaxsiy moliyani boshqarish, sun'iy intellekt tahlili va Telegram bot integratsiyasiga ega zamonaviy Full-Stack tizimini ishlab chiqish"

---

## 1. KIRISH

**Mavzuning dolzarbligi:**
Hozirgi shiddat bilan rivojlanayotgan raqamli iqtisodiyot davrida har bir shaxsning o'z moliyaviy resurslarini to'g'ri kuzatishi va boshqarishi muhim ahamiyat kasb etadi. Odamlar kundalik xarajatlarini nazorat qilish, daromadlarini to'g'ri taqsimlash va maqsadli jamg'armalar shakllantirishda ko'plab qiyinchiliklarga duch kelishadi. Turli bank ilovalari mavjudligiga qaramay, ularning aksariyati faqat bitta bankdagi tranzaksiyalarni ko'rsatadi, barcha naqd pullar, qarzlar va turli hisoblardagi mablag'larni umumlashtirib ko'rish imkonini bermaydi. Shuningdek, ularda moliyaviy savodxonlikni oshiruvchi aqlli maslahatchilar (sun'iy intellekt) integratsiyasi mavjud emas. Shu sababli, foydalanuvchining umumiy moliyaviy holatini markazlashgan holda boshqarish, tahlil qilish va qarzlar hamda vizual tarzda ko'rsatkichlarni yetkazib berishga qodir bo'lgan yaxlit AT (axborot texnologiyalari) tizimini ishlab chiqish g'oyat dolzarb hisoblanadi.

**Loyihaning maqsadi:**
Ushbu loyihaning asosiy maqsadi – foydalanuvchilarga shaxsiy byudjetni yuritish, daromad va xarajatlarni hisobga olish, qarzlarni avtomatlashtirilgan tarzda kuzatish va kelajakdagi moliyaviy maqsadlarga erishishda sun'iy intellektga (AI) asoslangan maslahatlar beruvchi innovatsion moliyaviy platforma (Fintech) yaratishdan iborat. Bu platforma ham veb-interfeys, ham kundalik oson kirish imkonini beruvchi Telegram bot platformasi orqali ishlashini ta'minlash ko'zda tutilgan.

**Qo'yilgan vazifalar:**
1. Foydalanuvchilarning pulli oqimlarini (daromad va xarajat) to'liq modelini ishlab chiqish va ma'lumotlar bazasini loyihalash.
2. Jamg'arma va qarz instrumentlari ustida ishlash uchun kompleks biznes-mantiq va algoritmlarni shakllantirish.
3. Sun'iy intellekt qatlamini tizimga ulash hamda moliyaviy kontekst orqali LLM (Large Language Model) lardan foydalanib maslahat olish modulini amalga oshirish.
4. Telegram orqali real vaqtida hisobotlar va bildirishnomalar (SMS, alert) berish tizimini qurish.
5. RESTful API arxitekturasi yordamida backend (Django) va frontend (React) o'rtasidagi ma'lumotlar sinxronizatsiyasini xavfsiz amalga oshirish.
6. Har tomonlama analitik tizim yaratish — haftalik, oylik va yillik jadvallar, grafiklar va Excel eksport funksiyasini ulash.

[RASM JOYI] 
*(Bu yerda: tizimning umumiy konsepsiyasini yoki landing page bosh sahifasini aks ettiruvchi sxematik chizma/skrinshot bo'lishi kerak)*

Ushbu amaliy hisobotda loyihaning har bir komponenti qanday rejalashtirilgani, qanday texnologik qarorlar qabul qilingani va amalda qanday realizatsiya qilingani haqida bosqichma-bosqich yoritib beriladi.

---

## 2. NAZARIY QISM

### 2.1. Tizim yaratishda tanlangan texnologiyalar asosi
Ushbu web-loyihani yaratish jarayonida Full-Stack dasturlashga xos bo'lgan optimal va zamonaviy texnologiyalar steck'i tanlandi.

**Backend – Django va Django REST Framework (DRF):**
Django — bu Python tili asosida yaratilgan, qisqa vaqt ichida mustahkam va xavfsiz backend tizimlarini qurishga mo'ljallangan framework. Uning xavfsizlik funksiyalari (CSRF, JWT ulanish imkoniyati, SQL injection himoyasi) moliyaviy platformalar uchun juda mos tushadi. Loyihada frontend bilan aloqani ta'minlash uchun Data Serialization (ma'lumotlarni jipslash va uzatish) ga yo'naltirilgan Django REST Framework ishlatilgan. U JSON formatida ma'lumot almashuvini juda oson standartlashtiradi.

**Frontend – React.js va Vite:**
Foydalanuvchilar qismida (Client-side) tezkor, moslashuvchan interfeys (Single Page Application - SPA) qurish uchun React.js tanlandi. React — komponentlarga asoslangan kutubxona bo'lib, moliyaviy ma'lumotlar (reaktiv narxlar, statisik grafiklar) ni sahifani qayta yuklamasdan silliq tasvirlab beradi. Dasturni yig'ish (build tooling) instrumenti sifatida eski va sekin ishlash xususiyatiga ega Webpack o'rniga zamonaviy Vite ishlatildi. Vite frontend qismini yashin tezligida ishga tushirish imkoniyatiga ega.

**Ma'lumotlar bazasi – PostgreSQL:**
Moliyaviy tizimlarda qat'iylik va "Tranzaksiya" xavfsizligi (ACID prinsiplari) juda muhim. Shuning uchun loyihada PostgreSQL munosabatli ma'lumotlar bazasidan foydalanildi. U parallel so'rovlarni mukammal ishlay oladi, pul aylanmasidagi (Decimal floating numbers) summalarni zarracha ham chalkashliksiz xotirada saqlaydi.

**AI Integratsiya – Google Gemini API:**
Bozordagi aksariyat dasturlarda faqat statistika bor. Lekin kullanuvchi "Bu oy moliyaviy ahvolim qanday, qarzlarimni oy oxiriga qadar yopa olamanmi?" degan savolni bermaydi. Shu mantiqni yopish uchun loyihaga Generativ Sun'iy intellekt moduli qo'shildi.

[RASM JOYI]
*(Bu yerda: Texnologiyalar steki — Python, Django, React, Postgres, Telegram, Gemini logolari birlashib turgan chiroyli arxitektura diagrammasi ko'rsatiladi)*

### 2.2. O'xshash loyihalar (Analoglar) tahlili
Bozor tahlili davomida "CoinKeeper", "Monefy" va "Zenmoney" kabi mashhur alternativalar o'rganildi.
Ulardagi umumiy *kuchli tomonlar:*
- Juda sodda interfeys, sarf-xarajatlarni kiritish bor yo'g'i 1-2 marta bosish bilan kifoyalanadi.
- Ajoyib doiraviy (pie-chart) grafiklar mavjud.
Ularning *zaif tomonlari va bizning loyihaning ustunligi:*
1. Analoglar faqat yozuv daftarchasi rolini bajarsada, "bizning tizim" sun'iy intellekt orqali foydalanuvchiga amaliy maslahatlar (tejamkorlik stavkasi, xavf analizlari) beradi.
2. Ularda asosan ilova o'rnatish shart (mobil ilova). Bizning loyihada esa maxsus Telegram Bot yordamida shunchaki chat orqali pul kiritish/analiz olish mumkinligi qo'shilgan, bu qulaylikni 10 barobarga oshiradi.

### 2.3. Tizim arxitekturasi tamoyillari
Tizim mikro-servislarga bo'linmagan bo'lsa-da, komponentli (modular monolith) arxitekturada qurilgan. Unga ko'ra:
- **Presentation Layer (Taqdimot qatlami):** React SPA vizual grafiklarni chizish bilan va Telegram bot chati frontend rolini o'ynaydi.
- **API Layer (Muloqot qatlami):** Djangoning marshrutlari (urls) va serializatorlari, kelgan http-so'rovlarni validatsiya qiladi.
- **Service Layer (Servis/Mantiq qatlami):** Barcha hisob kitob qoidalari (masalan pul o'tkazishdagi ayirish/qo'shish logic'lari) controller(view)da emas, maxsus `services.py` degan fayllarda abstraktsiyalangan.
- **Data Access Layer (Ma'lumotlar qatlami):** Modellar (models.py) to'g'ridan to'g'ri bazaga ulanadi.

Bunday yondashuv kod ifloslanishining (spaghetti code) oldini oldi va funksiyalar kengayishiga yo'l ochdi.

---

## 3. AMALIY QISM

Amaliy qism loyihaning tayvanchi hisoblanadi. Unda qilingan ishlar to'liq ketma-ketlikda yoritiladi.

### 3.1. Loyihaning to'liq tavsifi (Funksionallik)
Tizim asosan quyidagi muhim biznes talablarni qondiradigan bir qancha modullarga bo'lingan:

**A) Foydalanuvchi moduli (Authentication & Users)**
Xavfsizlik yuzasidan barcha foydalanuvchilar telefon raqamlari orqali ro'yxatdan o'tadilar va Email/OTP orqali tasdiqlab olinadi. Har bir foydalanuvchiga alohida JWT (JSON Web Token) beriladi.

**B) "Main Balance" (Asosiy hamyon) va Tranzaksiyalar moduli**
Loyihaning yadrosi o'zida har turli pul harakatlarini jamlovchi tranzaksiyalar kitobi — Ledger tamoyili hisoblanadi. Har qanday xarajat, kirim moliyaviy tranzaksiya obyektini yaratadi. Kategoriya bo'yicha guruhlanadi.

**D) Qarzlar (Loans) modeli**
Mavjud bozor amaliyotida foydalanuvchilar qarz oldi/berdi hisob-kitobida chalkashib ketishadi. Loyihada bu ochiq modellashtirilgan (o'zining "DIRECTION_CHOICES" xususiyati bor - `INCOMING` va `OUTGOING`). Ya'ni ham qarz olishni, ham atrofdagilarga (do'stlarga) qarz berishni bitta joyda boshqarish realizatsiya qilingan.

**E) Jamg'armalar (Savings & Goals)**
Inson psixologiyasini o'rgangan holda, jamg'armalarni oddiy emas, 'Maqsadlarga biriktirilgan' ko'rinishda qilish yo'lga qo'yildi. Masalan foydalanuvchi "Avtomobil uchun", "Ta'til uchun" degan target (maqsadlar) yaratadi. Platforma ularni avtomatik tarzda foiz hisoblab (Dotted Progress bar) ko'rsatib boradi.

[RASM JOYI]
*(Bu yerda: React interfeysining Jamg'arma va Maqsadlar oynasining vizual ko'rinishi, doiraviy grafik bo'lishi kerak)*

### 3.2. Ma'lumotlar oqimi (Data Flow)
Mantiqiy zanjir qanday ishlaydi? Keling, foydalanuvchi do'stiga 50,000 so'm qarz qaytargani misolida ma'lumotlar oqimini ko'ramiz.
1. Frontenddagi "Qarz qaytarish" tugmasi, formadan miqdorni (50,000) React state'ga saqlaydi.
2. Axios qonuniyatiga asosan `POST /api/finance/loans/{id}/repay/` endpointiga payload (`{"amount": 50000}`) jo'natiladi.
3. Backend `LoanRepaymentSerializer` orqali datani validatsiya qiladi: miqdor manfiy emasmi, tekst bormi?
4. Keyin bu ma'lumotlar `LoanService.record_repayment()` maxsus servis klassiga o'tadi.
   Servis ichida **Atomic Transaction** boshlanadi (agar xatolik chiqib qolsa barcha yozilgan fayllar bekor qilinadi (rollback)).
5. Servis foydalanuvchining Asosiy Balansini chaqiradi `validate_sufficient_balance()`. Agar balansda 50,000 so'm bo'lsa, uni ayirib saqlaydi.
6. Qarz (`Loan`) modelidagi "to'langan summa"ga 50,000 ni qo'shadi, va qarz to'liq yopilsa statusini 'SETTLED' (Yakunlandi) deb o'zgartiradi.
7. Xuddi shu vaziyat tarixda qolishi uchun "Transaction" yaratiladi (source_type='MAIN', dest_type='LOAN').
8. Va eng yakunida 200 OK statusi hamda yangilangan JSON ma'lumot frontendga qaytib borib, foydalanuvchi ekranida chiroyli "Qarz muvaffaqiyatli to'landi" alerti chiqadi.

### 3.3 Ma'lumotlar bazasi arxitekturasi va Modellarni tashkil qilish
Ilova reliesyonal modellarga asosan bog'langan:
* *User Model*: Djangoning default bazasi o'zgartirilib, `phone_number` primary autentifikator sifatida belgilandi. Bu lokal sharoitda odamlar login parol emas, raqam ishlatishi bilan optimallashgan.
* *Soft Delete (Yumshoq o'chirish) arxitekturasi*: Muhim moliyaviy tizimlarda shaxs ma'lumot o'chirib yuborganda u to'g'ridan to'g'ri bazadan yo'qolishi og'ir oqibatlarga, buxgalteriya farqlariga olib kelishi mumkin. Shuning uchun loyihaga mo'ljallab `SoftDeleteModel` yozildi. Foydalanuvchi o'chirdim deb o'ylagan tranzaksiyasi bazada `is_deleted=True` bo'lib filtr orasida ko'rinmay qoladi xolos, aslida esa u arxivlanadi. Bu katta muvaffaqiyat!
* *Polimorfik universal logika (Transaction Model)*: Kirim, chiqim, tejash yoki transfer — barchasi bitta M-kattalikdagi c model ichiga tushadi. Unga maxsus `source_type` va `destination_type` degan ustunlar qo'shilgan, shuningdek `transaction_group_id` UUID orqali ikkita xarajatni (o'zaro o'tkazma) bir biriga bog'lash mexanizmi yaratilgan.

[RASM JOYI]
*(Bu yerda: Foydalanuvchi (User), Transaction (Tranzaksiya), Loan (Qarz), Savings va Category jadvallari orasidagi bog'lanishlar DB yozilgan Entity Relationship (ER) Diagrammasi ko'rsatiladi)*

### 3.4 Interfeys elementlari va UI/UX qismi
Loyihada estetika uchun maxsus e'tibor qaratildi. Interfeys **Glassmorphism** va to'q ranglar (Dark Mode) ustida qurildi. Bu juda qimmat va professionallarga xos taassurot qoldiradi.
- **Sidebar (Yon panel):** Navigatsiya tizimi joylashgan bo'lib, sahifalarni almashish Single Page App xususiyati orqali chaqmoqdek tezlikda bo'ladi.
- **Form elementlari:** Barcha kiritish maydonlari (inputlar), tugmalar (buttonlar) hover(tashqi) effektlarga ega. 
- **Notification kartochkalari:** Pul kiritilgan onning o'zida yashil, xarajatda esa qizil mikro-animatsiyali "toast"lar chiqadi. Bu tugma bosilganda jarayon oxiriga yetganligi to'g'risida tasdiq belgisidir. 
  "Jamg'arma" vidjetlarining ichida esa maxsus CSS gradientli progress barlar (to'lish chiziqlari) ko'makida jami maqsadning necha foiziga erishilganligi nafis dizaynda uzatiladi.

### 3.5. Analitika va Excel Integratsiyasi
Moliyani sarhisob qilish, tizim maqsadi! Shuning uchun `reports.py` va `exports.py` yordamida quyidagi murakkab logikalar ishlab chiqildi:
1. Haftalik analiz — dushanbadan yakshanbagacha bo'lgan barcha oborotlar Djangoning maxsus Date aggretor funksiyalari (`TruncWeek` va h.k) bilan tahlil qilinib, natijani londa holatga keltiriladi.
2. "OpenPyxl" kutubxonasi yordamida, user o'z ma'lumotlarini rasmiy Excel Hujjatiga tushira oladi!
Kod xotirada binary ko'rinishida (*io.BytesIO()*) saqlanadi, server diskiga yozilmay to'g'ridan to'g'ri foydalanuvchiga jo'natib yuboriladi - bu fayl xavfsizligi yuzasidan eng yaxshi yechimdir. Excel varaqlari ranglarda formatirotka (`HEADER_FILL`) qilingani esa hujjatga o'zgacha chiroy bag'ishlaydi.

[RASM JOYI]
*(Bu yerda: Dasturning haftalik va oylik hisobotlari joylashgan Analitika oynasi grafiki skrinshoti bo'lishi lozim)*

### 3.6. Telegram Bot Integratsiyasi
Tizim foydalanuvchi uchun juda harakatchan qilib ishlangan. Shoshilinch joylarda odam kompyuter yonida bo'lmasligi mumkin, lekin qo'lida smartfon doim bor bo'ladi. 
Loyiha ichiga `python-telegram-bot` moduli kiritilgan:
- **Telegram bilan ro'yxatdan o'tish:**  Buning ham o'ziga yarasha aqlli qismi bor — bot foydalanuvchiga raqamini bermasa /start qabul qilmaydi. Telefon yozilgach, parolni so'raydi (xuddi akkaunt linking).
- **Muloqot klaviaturasi (Keyboard Layout):** Foydalanuvchiga yozishni kamaytirish uchun "💰 Balans", "📊 Umumiy holat", "📥 Excel hisobotlar" kabi chiroyli ReplyMarkup Button'lar chizib berilgan.  
Bot shunchaki oddiy zaproslarni jo'natadi, misol uchun "Oxirgi tranzaksiyalar" tugmasi bosilganda, bot orqa fonda backendga kirib foydalanuvchining shaxsiy ID si qatnashgan oxirgi 15ta harakatni `select_related()` (tezkor so'rov) texnikasi yordamida topib ekranga pechatlab beradi. Excel export funksiya maxsus tugma bilan to'g'ridan to'g'ri odam ismli hujjatni "document" shablonda telegram xat ko'rinishida generatsiya qiladi.

### 3.7. AI Chat — Sun'iy intellekt maslahatchisi
Loyiha markaziy "Wow" effect funksiyalaridan biri — bu AI moduli (`ai_views.py`).
Ilovada foydalanuvchi bot bilan yozishayotganda bu to'g'ridan to'g'ri Google Gemini modelaridan javob qaytaradi.
*Qanday ishlaydi?* (Mantiq tushuntilishi):
- So'rov kelib tushishi bilan, dastur avvalo insonning ayni paytdagi balanslarini, hamma qarzlarini, bu oydagi eng asosiy haridlari kategoriyasi (`top_categories`)larini birma-bir hisoblab jamlaydi.
- Shundan so'ng, tizim bot uchun maxsus *SYSTEM PROMPT* (Tizim ko'rsatmasi) tuzadi. Unda: "Sen aqlli moliyaviy ekspertsan, shaxs hozirda -50000 som salbiy byudjetda, u asosan ovqatga kop xarajat qilyapti" kabi tayyor kontekst matnni AI miyasiga jo'natib yuboradi.  
- AI bazadagi real moliyaviy manzara hisobiga user ga naprimer ("Siz bu oy choyxonaga va ko'ngilochar joylarga byudjetizni 40%ni sarflapsiz, buni qisqartirib jamg'armangizga 15% ajratsangiz qarzizni ertaroq yopasiz!") deb odamlarnikidek maslahat beradi.

Bu juda effektiv. AI aloqa uzilgan vaqtida (Gemini API timeout yo limit dan oshgan mementlarda), funksiya tushib qolmasligi uchun loyihaga *Lokal Fallback* yozilgan. Ya'ni aloqa yo'q bo'lsa sistema xato bermaydi, lokal o'zgartirish qoidalari bo'yicha maxsus yozilgan o'rdak-kod uzilmasdan analitik maslahat beraveradi.

[RASM JOYI]
*(Bu yerda: Sun'iy Intellekt maslahatchi xonasi oynasi (AI Chat) hamda xabarlashuv ko'rsatilgan chiziqli blok rasmidan foydalaniladi)*

---

## 4. TEXNIK QISM (ALGORTIMLAR VA KOD ISHLASH MANTIG'I)

Murakkab vazifalarni optimal yechish yo'lida tuzilgan qadamli tuzilmalar. Bu o'rinda "Jamg'armadan pul o'chirish" yo "Tranzaksiyani bekor qilish" algoritmiga e'tibor qaratish kerak. Tizimdagi eng mushkul qism Transactionni (Xarajat yozuvini) 'Tahrirlash' (Update/Delete) paytida Balanslarning matematik bukilishidir.

**Pseudo-kod tarzda tushuntirish:** 
Aytaylik, foydalanuvchi 200,000 so'mlik 'Oziq-ovqat' deb qilgan xarajatini keyinchalik adashibman, aslida 'Daromad' 300,000 kelgandi deb edit qildi.
Agar tizim buni reaktiv sezmasa nima bo'ladi? Pul yo'g'olib qoladi.

Algoritm mantig'i (`adjust_balance_for_transaction_update`):
1. BOSHLASH
2. Eski qiymat = 200,000 so'm (Chiqim)
3. Yangi qiymat = 300,000 so'm (Kirim)
4. Balansga avval eski operatsiya bekor (Revert) qilinadi: 
   - Modomiki avval chiqim bo'lgan ekan, Balans = Balans + 200,000. \`Balans o'z joyiga qaytdi.\`
5. Endi yangi operatsiya ro'yobga chiqariladi:
   - Modomiki yangi amal kirim ekan, Balans = Balans + 300,000.  
6. Saqlash operatsiyasi chaqiriladi.
7. TUGASh.

**Blok sxema ma'nosi:** Bu qismlar `services.py` dagi klasslar ko'magida, **SOLID tamoyillari** hamda bitta funksiyada 1 mas'uliyat (`Single Responsibility`) qoidasiga ko'ra soddalashtirib qurib bitilgan. Bu loyiha masshabini (Scalability) naqadar toza yozilganini anglatadi. Xavfsiz bo'lishi uchun esa har bir o'zgaruvchida `validate_positive_amount` valdatirlar o'rnatilgan. Sababi internetdan biron bir usta -300,000 lik (manfiy sonli) xarajat jo'nata qolsa, tizim bu kirim deya adashib ketishi mumkin. Barcha ma'lumotlar Decimal (Kallaklar bilan ishlash logikasi) xolatiga o'tkazilib tozalangan.

---

## 5. XAVFSIZLIK, KAMCHILIKLAR VA TAKOMILLASHTIRISH

**Xavfsizlik chora-tadbirlari:**
* JSON Web Token (JWT) — sessiyalarsiz, muddatli va imzoli parollar bo'lib, birov uni o'g'irlasa xam faqat bitta kun ishlaydi (Refresh and Access Tokens).
* Ma'lumotlarni o'chirishda arxivlash tamoyili qo'llanilgani tufayli (Soft Delete) tranzaksiyalar hamisha log ko'rinishida turadi, xaker ham nimanidir izsiz yo'qota olmaydi.
* Gemini API kalitlari serverga berkitilgan va mijozga faqat natija jo'natiladi.
* End-points CORS konfiguratsiyasi faqat ruxsat berilgan hostlarni (hozircha All_Origins, ammo prodakshnda keshlab va bog'lab) qabul qilishga tayyorlab qo'yilgan.

**Kamchiliklar va kutilajak kengayish imkoniyatlari (Future Scope):**
- Turli xil valyutalarni hisobga oluvchi qatlam hozircha kiritilmagan. Kelajakda (masalan, So'm va AQSH dollari konvertatsiyasi) integratsiyasi Markaziy Bankning public API(kurslari)dan foydalanib o'rnatilishi mumkin.
- Foydalanuvchilar orasida o'zaro (P2P) ichki pul o'tkazish tizimini tayyorlash bazaviy modellar ko'rinishida tayyor biroq alohida ijtimoiy funksiyaga uylanmagan (Ya'ni, bir kishining do'sti shu botda bo'lsa shunchaki qarz tugmasi orqali do'stining balansiga transfe qilish kabi logikalar).
- Django xabarlarida push notificationlari uchun asinxron logikani Celery yordamida ajratib yuborish. Hozirda bot ulanishlar sinxron qilinmoqda, bu juda katta yuzerlar vaqtida serverni navbat kuttirishga (bottleneck) sababchisi bo'lishi mumkin. Redis kabi asinxron echimni o'ylab ko'rish loyihani 10 barobarga tezlatadi.

---

## 6. XULOSA

Xulosa o'rnida aytish mumkinki, ushbu loyiha nafaqat talabalar yoki ishlashni yangi boshlaganlar, balki barcha qatlam odamlari uchun oddiy xarajat yozish kitobidan tortib to moliyaviy ongi baland ustazdek yordam bera oluvchi dasturiy mahsulot bo'lib yetishdi. 

Biz yaratgan bu kompleks yechim orqali React-ning SPA afzalligi yordamida vizual chiroyli statistikalarni tez tahlil qilish, shu qatorda Djangoning qat'iy va mantiqiy algoritmlari yordamida hisoblarni aralashib ketmasdan hisoblash ta'minlandi. Ijtimoiy tarmoqda bot yozish amaliyoti esa amaliy ijrochilikda barcha qulayliklarni bir joyga to'pladi, oddiy fuqaro murakkab tushunchalarni (qarz yopish strategiyalari, tejamkorlik qoidalari 50/30/20 kabi) AI yordamida har kuni o'rganib ko'nikma hosil qilishiga yordam berishi – bugungi asrimiz muammolaridan biriga yechim sifatidagi yuqori muvaffaqiyatdir.

---

## 7. FOYDALANILGAN ADABIYOTLAR VA RESURSLAR

1. Django rasmiy hujjatlari va texnik resurslari. URL: https://docs.djangoproject.com/
2. React.js va qatlamlarni optimal boshqarish usullari markazi. URL: https://react.dev/
3. Vincent, W. (2020). *Django for APIs: Build web APIs with Python and Django.*
4. Percival, H., & Gregory, B. (2020). *Architecture Patterns with Python.* O'Reilly Media.
5. RESTful yondashuv tamoyillari (Roy Fielding).
6. Google Gemini Generative AI rasmiy hujjatlari va Prompt muhandisligi asoslari. URL: https://ai.google.dev/
7. Python-Telegram-Bot rasmiy qo'llanmasi.
8. Moliyaviy savodxonlik, tejamkorlik formulasi va byudjetlashtirish nazariyasi (Harv Eker asarlari).
9. M. J. Fowler. *Patterns of Enterprise Application Architecture.* Addison-Wesley Professional.
10. SQL va PostgreSQL da tranzaksiyalar optimallashtirish muammolari tahlillari.
11. Vite frontend build tool rasmiy portali hujjatlari.
12. "Clean Code" tamoyillari, R.C. Martin (2008). Prentice Hall. 
13. Axios Client library and HTTP xavfsizlik nazariyalari.

---
// Hisobot oxiri.
