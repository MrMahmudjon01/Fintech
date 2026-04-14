from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, PendingUser, PasswordResetToken
from .serializers import (
    RegisterStartSerializer, RegisterVerifySerializer, 
    RegisterConfirmSerializer, LoginSerializer, LogoutSerializer,
    UserProfileSerializer, ChangePasswordSerializer, ChangePhoneSerializer,
    ForgotPasswordStartSerializer, ForgotPasswordConfirmSerializer
)
from .services import generate_otp, send_otp_email, hash_password, get_otp_expiration

class RegisterStartView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterStartSerializer(data=request.data)
        if serializer.is_valid():
            # Delete any existing pending user with same phone
            PendingUser.objects.filter(phone_number=serializer.validated_data['phone_number']).delete()
            
            PendingUser.objects.create(
                full_name=serializer.validated_data['full_name'],
                phone_number=serializer.validated_data['phone_number'],
                password=hash_password(serializer.validated_data['password'])
            )
            return Response({"message": "Step 1 complete. Proceed to verify email."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterVerifySerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            email = serializer.validated_data['email']
            
            try:
                pending_user = PendingUser.objects.get(phone_number=phone_number)
            except PendingUser.DoesNotExist:
                return Response({"error": "Pending user not found. Start registration first."}, status=status.HTTP_404_NOT_FOUND)
            
            otp = generate_otp()
            pending_user.email = email
            pending_user.verification_code = otp
            pending_user.expires_at = get_otp_expiration()
            pending_user.save()
            
            send_otp_email(email=email, otp=otp)
            
            return Response({"message": "OTP sent to email. Proceed to confirm."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterConfirmSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            verification_code = serializer.validated_data['verification_code']
            
            try:
                pending_user = PendingUser.objects.get(phone_number=phone_number)
            except PendingUser.DoesNotExist:
                return Response({"error": "Pending user not found."}, status=status.HTTP_404_NOT_FOUND)
            
            if pending_user.is_expired():
                return Response({"error": "Verification code expired."}, status=status.HTTP_400_BAD_REQUEST)
                
            if pending_user.verification_code != verification_code:
                return Response({"error": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Create the actual user
            user = User.objects.create(
                phone_number=pending_user.phone_number,
                full_name=pending_user.full_name,
                email=pending_user.email,
                password=pending_user.password, # already hashed
                is_verified=True,
                is_active=True
            )
            
            # Delete pending user
            pending_user.delete()
            
            return Response({"message": "Registration complete. You can now login."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if serializer.is_valid():
            try:
                refresh_token = serializer.validated_data['refresh']
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
            except Exception:
                return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({"error": "Eski parol noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"message": "Parol muvaffaqiyatli o'zgartirildi."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChangePhoneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePhoneSerializer(data=request.data)
        if serializer.is_valid():
            new_phone = serializer.validated_data['new_phone_number']
            if User.objects.filter(phone_number=new_phone).exists():
                return Response({"error": "Bu raqam allaqachon band."}, status=status.HTTP_400_BAD_REQUEST)
            
            user = request.user
            user.phone_number = new_phone
            user.save()
            return Response({"message": "Telefon raqam muvaffaqiyatli o'zgartirildi."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ForgotPasswordStartView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordStartSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            try:
                user = User.objects.get(phone_number=phone_number)
            except User.DoesNotExist:
                return Response({"error": "Bunday raqamli foydalanuvchi topilmadi."}, status=status.HTTP_404_NOT_FOUND)
            
            # Clear existing tokens
            PasswordResetToken.objects.filter(user=user).delete()
            
            otp = generate_otp()
            PasswordResetToken.objects.create(
                user=user,
                verification_code=otp,
                expires_at=get_otp_expiration()
            )
            
            if user.email:
                try:
                    send_otp_email(user.email, otp)
                except Exception as e:
                    print(f"Failed to send email to {user.email}: {e}")
            
            print(f"OTPs for reset generated: {otp} for {user.phone_number}") # Mock output for manual check
            
            return Response({"message": "Tasdiqlash kodi yuborildi."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ForgotPasswordConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordConfirmSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            verification_code = serializer.validated_data['verification_code']
            new_password = serializer.validated_data['new_password']
            
            try:
                user = User.objects.get(phone_number=phone_number)
            except User.DoesNotExist:
                return Response({"error": "Foydalanuvchi topilmadi."}, status=status.HTTP_404_NOT_FOUND)
                
            try:
                reset_token = PasswordResetToken.objects.get(user=user)
            except PasswordResetToken.DoesNotExist:
                return Response({"error": "Tasdiqlash kodi so'ralmagan."}, status=status.HTTP_400_BAD_REQUEST)
                
            if reset_token.is_expired():
                return Response({"error": "Kodning vaqti tugagan."}, status=status.HTTP_400_BAD_REQUEST)
                
            if reset_token.verification_code != verification_code:
                return Response({"error": "Kod noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)
                
            user.set_password(new_password)
            user.save()
            
            reset_token.delete()
            
            return Response({"message": "Parol muvaffaqiyatli tiklandi."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
