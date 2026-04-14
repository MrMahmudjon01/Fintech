from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import MainBalance, Category, Transaction, Loan, Savings, Goal, Notification
from .serializers import (
    MainBalanceSerializer, CategorySerializer, TransactionSerializer,
    TransactionCreateSerializer, TransferCreateSerializer,
    LoanSerializer, LoanCreateSerializer, LoanRepaymentSerializer,
    SavingsSerializer, SavingsDepositSerializer,
    GoalSerializer, NotificationSerializer,
)
from .services import BalanceService, SavingsService, LoanService, TransferService


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ─────────────────────────────────────────────────────────
# MAIN BALANCE
# ─────────────────────────────────────────────────────────
class MainBalanceViewSet(viewsets.ViewSet):
    """Read-only viewset for the user's main balance."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        balance = BalanceService.get_or_create(request.user)
        serializer = MainBalanceSerializer(balance)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────
# CATEGORIES
# ─────────────────────────────────────────────────────────
class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user).order_by('type', 'name')


# ─────────────────────────────────────────────────────────
# TRANSACTIONS
# ─────────────────────────────────────────────────────────
class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = Transaction.objects.filter(
            user=self.request.user
        ).select_related('category')

        # Filters
        tx_type = self.request.query_params.get('type')
        source_type = self.request.query_params.get('source_type')
        source_id = self.request.query_params.get('source_id')
        destination_type = self.request.query_params.get('destination_type')
        destination_id = self.request.query_params.get('destination_id')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        category = self.request.query_params.get('category')

        if tx_type:
            queryset = queryset.filter(type=tx_type)
        if source_type:
            queryset = queryset.filter(source_type=source_type)
        if source_id:
            queryset = queryset.filter(source_id=source_id)
        if destination_type:
            queryset = queryset.filter(destination_type=destination_type)
        if destination_id:
            queryset = queryset.filter(destination_id=destination_id)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        if category:
            queryset = queryset.filter(category_id=category)

        return queryset.order_by('-date', '-created_at')

    def create(self, request, *args, **kwargs):
        """Create income/expense transaction via service layer."""
        serializer = TransactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            category = None
            category_id = data.get('category')
            if category_id and str(category_id).strip():
                category = Category.objects.get(id=category_id, user=request.user)

            if data['type'] == 'INCOME':
                tx = BalanceService.add_income(
                    user=request.user,
                    amount=data['amount'],
                    category=category,
                    note=data.get('note'),
                    date=data.get('date'),
                )
            elif data['type'] == 'SAVING':
                if not data.get('savings_id'):
                    raise ValueError("Jamg'arma ID talab qilinadi")
                tx = SavingsService.deposit(
                    user=request.user,
                    savings_id=data['savings_id'],
                    amount=data['amount'],
                    note=data.get('note'),
                    date=data.get('date'),
                )
            else:
                tx = BalanceService.record_expense(
                    user=request.user,
                    amount=data['amount'],
                    category=category,
                    note=data.get('note'),
                    date=data.get('date'),
                )

            return Response(
                TransactionSerializer(tx).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        """Transfer between accounts."""
        serializer = TransferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            tx = TransferService.transfer(
                user=request.user,
                from_type=data['from_type'],
                to_type=data['to_type'],
                amount=data['amount'],
                from_id=data.get('from_id'),
                to_id=data.get('to_id'),
                note=data.get('note'),
            )
            return Response(
                TransactionSerializer(tx).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_savings(self, request):
        """Get transactions related to a specific savings account."""
        savings_id = request.query_params.get('savings_id')
        if not savings_id:
            return Response({'error': 'savings_id required'}, status=400)

        txs = Transaction.objects.filter(
            user=request.user
        ).filter(
            models_Q_savings_filter(savings_id)
        ).select_related('category').order_by('-date', '-created_at')

        page = self.paginate_queryset(txs)
        if page is not None:
            return self.get_paginated_response(TransactionSerializer(page, many=True).data)
        return Response(TransactionSerializer(txs, many=True).data)

    @action(detail=False, methods=['get'])
    def by_loan(self, request):
        """Get transactions related to a specific loan."""
        loan_id = request.query_params.get('loan_id')
        if not loan_id:
            return Response({'error': 'loan_id required'}, status=400)

        from django.db.models import Q
        txs = Transaction.objects.filter(
            user=request.user
        ).filter(
            Q(source_type='LOAN', source_id=loan_id) |
            Q(destination_type='LOAN', destination_id=loan_id)
        ).select_related('category').order_by('-date', '-created_at')

        page = self.paginate_queryset(txs)
        if page is not None:
            return self.get_paginated_response(TransactionSerializer(page, many=True).data)
        return Response(TransactionSerializer(txs, many=True).data)


def models_Q_savings_filter(savings_id):
    """Helper to filter transactions by savings involvement."""
    from django.db.models import Q
    return (
        Q(source_type='SAVINGS', source_id=savings_id) |
        Q(destination_type='SAVINGS', destination_id=savings_id)
    )


# ─────────────────────────────────────────────────────────
# SAVINGS
# ─────────────────────────────────────────────────────────
class SavingsViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Savings.objects.filter(
            user=self.request.user
        ).prefetch_related('goals').order_by('-created_at')

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        """Deposit funds from main balance to this savings."""
        serializer = SavingsDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tx = SavingsService.deposit(
                user=request.user,
                savings_id=pk,
                amount=serializer.validated_data['amount'],
                note=serializer.validated_data.get('note'),
            )
            savings = self.get_object()
            return Response({
                'savings': SavingsSerializer(savings).data,
                'transaction': TransactionSerializer(tx).data,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw funds from savings to main balance."""
        serializer = SavingsDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tx = SavingsService.withdraw(
                user=request.user,
                savings_id=pk,
                amount=serializer.validated_data['amount'],
                note=serializer.validated_data.get('note'),
            )
            savings = self.get_object()
            return Response({
                'savings': SavingsSerializer(savings).data,
                'transaction': TransactionSerializer(tx).data,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────
# GOALS
# ─────────────────────────────────────────────────────────
class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Goal.objects.filter(savings__user=self.request.user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def add_funds(self, request, pk=None):
        """Allocate funds from savings to this goal."""
        goal = self.get_object()
        amount = request.data.get('amount')

        try:
            tx = SavingsService.allocate_to_goal(
                user=request.user,
                savings_id=goal.savings.id,
                goal_id=goal.id,
                amount=amount,
            )
            goal.refresh_from_db()
            return Response({
                'goal': GoalSerializer(goal).data,
                'transaction': TransactionSerializer(tx).data,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────
# LOANS
# ─────────────────────────────────────────────────────────
class LoanViewSet(viewsets.ModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return Loan.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create loan with destination routing via service layer."""
        serializer = LoanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            loan = LoanService.create_loan(
                user=request.user,
                person_name=data['person_name'],
                amount=data['amount'],
                direction=data['direction'],
                destination=data.get('destination', 'MAIN'),
                destination_savings_id=data.get('destination_savings_id'),
                due_date=data.get('due_date'),
                date=data.get('date'),
                note=data.get('note'),
            )
            return Response(
                LoanSerializer(loan).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def repay(self, request, pk=None):
        """Record a loan repayment."""
        serializer = LoanRepaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            loan = LoanService.record_repayment(
                user=request.user,
                loan_id=pk,
                amount=serializer.validated_data['amount'],
                note=serializer.validated_data.get('note'),
            )
            return Response(LoanSerializer(loan).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})
