from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, PendingUser

class RegisterStartSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_phone_number(self, value):
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return value


class RegisterVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    email = serializers.EmailField()

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class RegisterConfirmSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    verification_code = serializers.CharField(max_length=6)


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        phone_number = data.get('phone_number')
        password = data.get('password')

        user = authenticate(username=phone_number, password=password)
        if not user:
            raise serializers.ValidationError("Invalid login credentials.")
            
        if not user.is_verified:
            raise serializers.ValidationError("User is not verified.")

        refresh = RefreshToken.for_user(user)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'phone_number': user.phone_number,
                'full_name': user.full_name,
                'email': user.email
            }
        }

class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'phone_number', 'full_name', 'email', 'created_at']
        read_only_fields = ['id', 'created_at']

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

class ChangePhoneSerializer(serializers.Serializer):
    new_phone_number = serializers.CharField(required=True, max_length=20)

class ForgotPasswordStartSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=True, max_length=20)

class ForgotPasswordConfirmSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=True, max_length=20)
    verification_code = serializers.CharField(required=True, max_length=6)
    new_password = serializers.CharField(required=True, min_length=6)
