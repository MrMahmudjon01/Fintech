import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync
from telegram import Update
from .bot import get_application

telegram_app = get_application()
is_initialized = False

@csrf_exempt
def telegram_webhook(request):
    global is_initialized
    if request.method == 'POST':
        try:
            # Kelgan ma'lumotlarni o'qish
            update_data = json.loads(request.body)
            
            if telegram_app:
                # Update obyekti va telegram_app ni asinxron ishlatish uchun
                @async_to_sync
                async def process_update():
                    global is_initialized
                    if not is_initialized:
                        await telegram_app.initialize()
                        is_initialized = True
                    update = Update.de_json(update_data, telegram_app.bot)
                    await telegram_app.process_update(update)
                
                # Update ni asinxron ishga tushirish
                process_update()
            
            # Telegram API'ga so'rov muvaffaqiyatli qabul qilinganini bildirish muhim
            return JsonResponse({"status": "ok"})
        except Exception as e:
            print("Webhook xatoligi:", e)
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
            
    return JsonResponse({"error": "Not allowed"}, status=405)
