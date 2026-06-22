#!/usr/bin/env bash
# exit on error
set -o errexit

echo "📦 Frontend kutubxonalarini o'rnatish va build qilish..."
cd frontend
npm install
npm run build
cd ..

echo "🐍 Backend kutubxonalarini o'rnatish..."
pip install -r requirements.txt

echo "🗄️ Statik fayllarni yig'ish..."
python manage.py collectstatic --no-input

echo "💾 Ma'lumotlar bazasi migratsiyalarini bajarish..."
python manage.py migrate
