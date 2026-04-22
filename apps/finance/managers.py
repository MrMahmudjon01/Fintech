from django.db import models


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet that filters out soft-deleted records by default."""

    def delete(self):
        """Soft delete all records in queryset."""
        from django.utils import timezone
        return self.update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        """Actually delete records from database."""
        return super().delete()

    def alive(self):
        """Return only non-deleted records."""
        return self.filter(is_deleted=False)

    def dead(self):
        """Return only soft-deleted records."""
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    """Default manager that excludes soft-deleted records."""

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class AllObjectsManager(models.Manager):
    """Manager that includes soft-deleted records (for admin/audit)."""

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)
