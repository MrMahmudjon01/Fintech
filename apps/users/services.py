import random
import string
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.conf import settings

def generate_otp():
    """Generates a 6-digit optional OTP code"""
    return ''.join(random.choices(string.digits, k=6))

def send_otp_email(email, otp):
    """Sends OTP email to the user"""
    subject = 'Your Verification Code'
    message = f'Your verification code is: {otp}. It expires in 5 minutes.'
    from_email = settings.EMAIL_HOST_USER
    send_mail(subject, message, from_email, [email], fail_silently=False)

def hash_password(password):
    """Hashes the user password"""
    return make_password(password)

def get_otp_expiration():
    """Returns the expiration time for the OTP (5 minutes from now)"""
    return timezone.now() + timedelta(minutes=5)
