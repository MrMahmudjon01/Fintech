from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.core.exceptions import ValidationError

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
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = Transaction.objects.filter(
            user=self.request.user
        ).select_related('category')

        tx_type = self.request.query_params.get('type')
        if tx_type:
            queryset = queryset.filter(type=tx_type)

        return queryset.order_by('-date', '-created_at')

    def create(self, request, *args, **kwargs):
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
                    user=request.user, amount=data['amount'],
                    category=category, note=data.get('note'), date=data.get('date'),
                )
            elif data['type'] == 'SAVING':
                savings_id = data.get('savings_id')
                if not savings_id:
                    # Create or get standard global pool
                    savings, _ = Savings.objects.get_or_create(user=request.user, name="Asosiy Jamg'arma")
                    savings_id = savings.id
                
                tx = SavingsService.deposit(
                    user=request.user, savings_id=savings_id,
                    amount=data['amount'], note=data.get('note'), date=data.get('date'),
                )
            else:
                tx = BalanceService.record_expense(
                    user=request.user, amount=data['amount'],
                    category=category, note=data.get('note'), date=data.get('date'),
                )

            return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        tx = self.get_object()
        data = request.data
        
        new_type = data.get('type', tx.type)
        new_amount = data.get('amount', tx.amount)
        new_note = data.get('note', tx.note)
        new_date = data.get('date', tx.date)
        
        category_id = data.get('category')
        new_category = tx.category
        if category_id is not None:
            if category_id == '':
                new_category = None
            else:
                new_category = Category.objects.get(id=category_id, user=request.user)

        try:
            updated_tx = BalanceService.adjust_balance_for_transaction_update(
                user=request.user, tx=tx, new_type=new_type, new_amount=new_amount,
                new_category=new_category, new_note=new_note, new_date=new_date
            )
            return Response(TransactionSerializer(updated_tx).data)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        tx = self.get_object()
        try:
            BalanceService.adjust_balance_for_transaction_delete(user=request.user, tx=tx)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        serializer = TransferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            tx = TransferService.transfer(
                user=request.user, from_type=data['from_type'], to_type=data['to_type'],
                amount=data['amount'], from_id=data.get('from_id'), to_id=data.get('to_id'), note=data.get('note'),
            )
            return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_savings(self, request):
        savings_id = request.query_params.get('savings_id')
        if not savings_id: return Response({'error': 'savings_id required'}, status=400)
        from django.db.models import Q
        txs = Transaction.objects.filter(user=request.user).filter(
            Q(source_type='SAVINGS', source_id=savings_id) | Q(destination_type='SAVINGS', destination_id=savings_id)
        ).select_related('category').order_by('-date', '-created_at')
        page = self.paginate_queryset(txs)
        if page is not None: return self.get_paginated_response(TransactionSerializer(page, many=True).data)
        return Response(TransactionSerializer(txs, many=True).data)

    @action(detail=False, methods=['get'])
    def by_loan(self, request):
        loan_id = request.query_params.get('loan_id')
        if not loan_id: return Response({'error': 'loan_id required'}, status=400)
        from django.db.models import Q
        txs = Transaction.objects.filter(user=request.user).filter(
            Q(source_type='LOAN', source_id=loan_id) | Q(destination_type='LOAN', destination_id=loan_id)
        ).select_related('category').order_by('-date', '-created_at')
        page = self.paginate_queryset(txs)
        if page is not None: return self.get_paginated_response(TransactionSerializer(page, many=True).data)
        return Response(TransactionSerializer(txs, many=True).data)


# ─────────────────────────────────────────────────────────
# SAVINGS & GOALS
# ─────────────────────────────────────────────────────────
class SavingsViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Savings.objects.filter(user=self.request.user).prefetch_related('goals').order_by('-created_at')

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        serializer = SavingsDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            tx = SavingsService.deposit(user=request.user, savings_id=pk, amount=serializer.validated_data['amount'], note=serializer.validated_data.get('note'))
            return Response({'savings': SavingsSerializer(self.get_object()).data, 'transaction': TransactionSerializer(tx).data})
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        serializer = SavingsDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            tx = SavingsService.withdraw(user=request.user, savings_id=pk, amount=serializer.validated_data['amount'], note=serializer.validated_data.get('note'))
            return Response({'savings': SavingsSerializer(self.get_object()).data, 'transaction': TransactionSerializer(tx).data})
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Goal.objects.filter(savings__user=self.request.user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def add_funds(self, request, pk=None):
        goal = self.get_object()
        amount = request.data.get('amount')
        try:
            tx = SavingsService.allocate_to_goal(user=request.user, savings_id=goal.savings.id, goal_id=goal.id, amount=amount)
            goal.refresh_from_db()
            return Response({'goal': GoalSerializer(goal).data, 'transaction': TransactionSerializer(tx).data})
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def withdraw_funds(self, request, pk=None):
        goal = self.get_object()
        amount = request.data.get('amount')
        try:
            tx = SavingsService.withdraw_from_goal(user=request.user, goal_id=goal.id, amount=amount)
            goal.refresh_from_db()
            return Response({'goal': GoalSerializer(goal).data, 'transaction': TransactionSerializer(tx).data})
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)


# ─────────────────────────────────────────────────────────
# LOANS
# ─────────────────────────────────────────────────────────
class LoanViewSet(viewsets.ModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        return Loan.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = LoanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            loan = LoanService.create_loan(
                user=request.user, person_name=data['person_name'], amount=data['amount'],
                direction=data['direction'], due_date=data.get('due_date'), date=data.get('date'), note=data.get('note')
            )
            return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)

    def update(self, request, *args, **kwargs):
        loan = self.get_object()
        data = request.data
        try:
            updated_loan = LoanService.update_loan(
                user=request.user, loan_id=loan.id,
                new_person_name=data.get('person_name', loan.person_name),
                new_amount=data.get('amount', loan.amount),
                new_direction=data.get('direction', loan.direction),
                new_due_date=data.get('due_date', loan.due_date),
                new_date=data.get('date', loan.date),
                new_note=data.get('note', loan.note),
            )
            return Response(LoanSerializer(updated_loan).data)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)

    def destroy(self, request, *args, **kwargs):
        loan = self.get_object()
        try:
            LoanService.delete_loan(user=request.user, loan_id=loan.id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def repay(self, request, pk=None):
        serializer = LoanRepaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            loan = LoanService.record_repayment(
                user=request.user, loan_id=pk, amount=serializer.validated_data['amount'], note=serializer.validated_data.get('note')
            )
            return Response(LoanSerializer(loan).data)
        except ValidationError as e:
            return Response({'error': e.messages[0] if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({'error': str(e)}, status=400)


# ─────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self): return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def unread_count(self, request): return Response({'count': Notification.objects.filter(user=request.user, is_read=False).count()})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})
