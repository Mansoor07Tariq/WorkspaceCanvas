from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Desk


@receiver(pre_save, sender=Desk)
def _desk_capture_active_state(sender, instance: Desk, **kwargs) -> None:
    """
    Capture the current DB-persisted is_active value before the save so that
    post_save can detect an active→inactive transition.

    New (unsaved) desks have no prior DB row; _pre_save_is_active is set to None.
    """
    if instance.pk is None:
        instance._pre_save_is_active = None
        return
    try:
        instance._pre_save_is_active = (
            Desk.objects.filter(pk=instance.pk)
            .values_list("is_active", flat=True)
            .get()
        )
    except Desk.DoesNotExist:
        instance._pre_save_is_active = None


@receiver(post_save, sender=Desk)
def _desk_cascade_cancel_on_deactivation(
    sender, instance: Desk, created: bool, update_fields, **kwargs
) -> None:
    """
    When a Desk transitions is_active True → False, cancel all active bookings.

    This fires for direct model saves (admin, management commands, scripts) as
    well as the API path.  The API path (DeskDetailView.delete) already cancels
    bookings with cancelled_by=request.user *before* calling desk.save(), so
    the service call here will find zero ACTIVE rows and is a safe no-op.

    Limitation: bulk queryset updates (Desk.objects.filter(...).update(is_active=False))
    do NOT trigger Django signals.  Those code paths should call
    cancel_active_bookings_for_desk() explicitly or use the API/service layer.
    """
    if created:
        return

    # If only specific fields were saved and is_active is not among them, skip.
    if update_fields is not None and "is_active" not in update_fields:
        return

    pre_active = getattr(instance, "_pre_save_is_active", None)
    if pre_active is True and instance.is_active is False:
        from .services.booking_service import cancel_active_bookings_for_desk

        cancel_active_bookings_for_desk(instance, cancelled_by=None)
