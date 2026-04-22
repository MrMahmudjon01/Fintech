from rest_framework import serializers
from .models import MainBalance, Category, Transaction, Loan, Savings, Goal, Notification


class MainBalanceSerializer(serializers.ModelSerializer):
    weekly_change = serializers.SerializerMethodField()

    class Meta:
        model = MainBalance
        fields = [
            'id', 'total_amount', 'weekly_start_amount',
            'week_start_date', 'weekly_change', 'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_weekly_change(self, obj):
        return str(obj.total_amount - obj.weekly_start_amount)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'type', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    destination_type_display = serializers.CharField(source='get_destination_type_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'type', 'type_display', 'amount', 'note', 'date',
            'category', 'category_name',
            'source_type', 'source_type_display', 'source_id',
            'destination_type', 'destination_type_display', 'destination_id',
            'transaction_group_id', 'created_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'transaction_group_id',
            'source_type_display', 'destination_type_display', 'type_display',
        ]


class TransactionCreateSerializer(serializers.Serializer):
    """Input serializer for creating income/expense transactions."""
    type = serializers.ChoiceField(choices=['INCOME', 'EXPENSE', 'SAVING'])
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    category = serializers.IntegerField(required=False, allow_null=True)
    savings_id = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default='')
    date = serializers.DateField(required=False)


class TransferCreateSerializer(serializers.Serializer):
    """Input serializer for transfers between accounts."""
    from_type = serializers.ChoiceField(choices=['MAIN', 'SAVINGS'])
    to_type = serializers.ChoiceField(choices=['MAIN', 'SAVINGS'])
    from_id = serializers.IntegerField(required=False, allow_null=True)
    to_id = serializers.IntegerField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = ['id', 'savings', 'name', 'target_amount', 'current_amount', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class SavingsSerializer(serializers.ModelSerializer):
    goals = GoalSerializer(many=True, read_only=True)
    progress_percent = serializers.ReadOnlyField()
    is_below_minimum = serializers.ReadOnlyField()

    class Meta:
        model = Savings
        fields = [
            'id', 'name', 'current_amount', 'target_amount',
            'minimum_limit', 'status', 'progress_percent',
            'is_below_minimum', 'goals', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'current_amount', 'status', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SavingsDepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class LoanSerializer(serializers.ModelSerializer):
    remaining_amount = serializers.ReadOnlyField()
    repayment_percent = serializers.ReadOnlyField()

    class Meta:
        model = Loan
        fields = [
            'id', 'person_name', 'amount', 'amount_paid',
            'remaining_amount', 'repayment_percent',
            'direction', 'status', 'due_date', 'date', 'note',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'amount_paid', 'status', 'created_at', 'updated_at']


class LoanCreateSerializer(serializers.Serializer):
    """Input serializer for creating loans — always routes to MainBalance."""
    person_name = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    direction = serializers.ChoiceField(choices=['INCOMING', 'OUTGOING'])
    due_date = serializers.DateField(required=False, allow_null=True)
    date = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class LoanRepaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'is_read', 'type',
            'related_object_type', 'related_object_id',
            'is_sent_telegram', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
