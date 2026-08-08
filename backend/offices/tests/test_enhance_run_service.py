"""Service-level unit tests for :class:`EnhanceRunService` (TD-052).

These exercise the service DIRECTLY — no DRF request, no APIClient, no HTTP —
which is the acceptance criterion for the extraction: the orchestration must be
usable from a non-HTTP caller (a future bot integration). The HTTP contract
itself stays pinned by ``test_enhance_runs.py``; these prove the same behaviour
is reachable through the plain Python API.
"""

import pytest
from django.contrib.auth import get_user_model

from accounts.models import Organization
from offices.models import (
    EnhanceRun,
    EnhanceRunOperation,
    Floor,
    FloorLayoutObject,
    Office,
)
from offices.services.enhance_run_service import (
    EnhanceRunNotFoundError,
    EnhanceRunResult,
    EnhanceRunService,
)

User = get_user_model()


# ─── Helpers / fixtures ──────────────────────────────────────────────────────


def _geom(x="100.00", y="100.00", width="50.00", height="50.00", rotation="0.00"):
    return {"x": x, "y": y, "width": width, "height": height, "rotation": rotation}


def _op(object_id, before, patch, reason_codes=None):
    """A validated-operation dict in the shape the serializer would hand the
    service (object_id / before / patch / reason_codes)."""
    return {
        "object_id": object_id,
        "before": before,
        "patch": patch,
        "reason_codes": reason_codes or [],
    }


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def office(db, org):
    return Office.objects.create(
        organization=org, name="Dublin Office", slug="dublin-office"
    )


@pytest.fixture
def floor(db, office):
    return Floor.objects.create(office=office, name="Ground", slug="ground")


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="bot@example.com", email="bot@example.com", password="Strongpass1!"
    )


@pytest.fixture
def service():
    return EnhanceRunService()


def _make_obj(floor, x="100.00", is_active=True):
    return FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        x=x,
        y="100.00",
        width="50.00",
        height="50.00",
        rotation="0.00",
        is_active=is_active,
    )


# ─── apply ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_apply_happy_all_applied(service, floor, user):
    obj = _make_obj(floor, x="100.00")

    result = service.apply(
        floor=floor,
        user=user,
        plan_id="p-happy",
        operations=[_op(obj.id, _geom(x="100.00"), {"x": "200.00"})],
    )

    assert isinstance(result, EnhanceRunResult)
    assert result.run.status == EnhanceRun.Status.SUCCESS
    assert result.run.applied_count == 1
    assert result.run.failed_count == 0
    assert result.run.skipped_count == 0
    assert result.run.triggered_by_id == user.id
    assert [o.id for o in result.updated_objects] == [obj.id]
    obj.refresh_from_db()
    assert float(obj.x) == 200.0


@pytest.mark.django_db
def test_apply_partial_mixed_applied_failed_skipped(service, floor, user):
    good = _make_obj(floor, x="100.00")  # will apply
    bad = _make_obj(floor, x="100.00")  # invalid patch → failed

    result = service.apply(
        floor=floor,
        user=user,
        plan_id="p-partial",
        operations=[
            _op(good.id, _geom(x="100.00"), {"x": "200.00"}),
            _op(bad.id, _geom(x="100.00"), {"width": "-1.00"}),  # width>0 → invalid
            _op(999999, _geom(x="100.00"), {"x": "200.00"}),  # not on floor → skipped
        ],
    )

    assert result.run.status == EnhanceRun.Status.PARTIAL_SUCCESS
    assert result.run.applied_count == 1
    assert result.run.failed_count == 1
    assert result.run.skipped_count == 1
    assert [o.id for o in result.updated_objects] == [good.id]

    rows = {r.object_id: r for r in result.run.operations.all()}
    assert rows[good.id].status == EnhanceRunOperation.Status.APPLIED
    assert rows[bad.id].status == EnhanceRunOperation.Status.FAILED
    assert rows[bad.id].error_code == "validation_error"
    assert rows[999999].status == EnhanceRunOperation.Status.SKIPPED
    assert rows[999999].error_code == "object_not_available_for_floor"

    good.refresh_from_db()
    bad.refresh_from_db()
    assert float(good.x) == 200.0
    assert float(bad.x) == 100.0  # failed op rolled back to its savepoint


@pytest.mark.django_db
def test_apply_idempotent_replay_returns_same_run(service, floor, user):
    obj = _make_obj(floor, x="100.00")
    ops = [_op(obj.id, _geom(x="100.00"), {"x": "200.00"})]

    first = service.apply(floor=floor, user=user, plan_id="p-dup", operations=ops)
    # A second call with the SAME plan_id must replay, not re-apply.
    second = service.apply(floor=floor, user=user, plan_id="p-dup", operations=ops)

    assert second.run.id == first.run.id
    assert EnhanceRun.objects.filter(floor=floor, plan_id="p-dup").count() == 1
    assert [o.id for o in second.updated_objects] == [obj.id]
    obj.refresh_from_db()
    assert float(obj.x) == 200.0  # unchanged by the replay


# ─── undo ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_undo_restores_applied_geometry(service, floor, user):
    obj = _make_obj(floor, x="100.00")
    applied = service.apply(
        floor=floor,
        user=user,
        plan_id="p-undo",
        operations=[_op(obj.id, _geom(x="100.00"), {"x": "200.00"})],
    )
    obj.refresh_from_db()
    assert float(obj.x) == 200.0

    result = service.undo(floor=floor, user=user, run_id=applied.run.id)

    assert result.run.kind == EnhanceRun.Kind.UNDO
    assert result.run.parent_run_id == applied.run.id
    assert result.run.applied_count == 1
    obj.refresh_from_db()
    assert float(obj.x) == 100.0  # restored to before_geometry


@pytest.mark.django_db
def test_undo_skips_object_moved_after_apply(service, floor, user):
    obj = _make_obj(floor, x="100.00")
    applied = service.apply(
        floor=floor,
        user=user,
        plan_id="p-undo-stale",
        operations=[_op(obj.id, _geom(x="100.00"), {"x": "200.00"})],
    )
    # User manually moves the object after the run → undo must NOT clobber it.
    FloorLayoutObject.objects.filter(pk=obj.pk).update(x="300.00")

    result = service.undo(floor=floor, user=user, run_id=applied.run.id)

    assert result.run.skipped_count == 1
    assert result.run.applied_count == 0
    row = result.run.operations.get(object_id=obj.id)
    assert row.status == EnhanceRunOperation.Status.SKIPPED
    assert row.error_code == "stale_geometry"
    obj.refresh_from_db()
    assert float(obj.x) == 300.0  # manual edit preserved


@pytest.mark.django_db
def test_undo_unknown_run_raises(service, floor, user):
    with pytest.raises(EnhanceRunNotFoundError):
        service.undo(floor=floor, user=user, run_id=999999)


# ─── retry ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_retry_reapplies_failed_op(service, floor, user):
    obj = _make_obj(floor, x="100.00")
    # Seed a run with a FAILED op whose stored patch is actually valid (models a
    # transient save failure). Retry should re-attempt and succeed.
    source = EnhanceRun.objects.create(
        floor=floor,
        triggered_by=user,
        kind=EnhanceRun.Kind.APPLY,
        plan_id="p-retry-src",
        status=EnhanceRun.Status.FAILED,
        total_operations=1,
        failed_count=1,
    )
    EnhanceRunOperation.objects.create(
        enhance_run=source,
        object_id=obj.id,
        status=EnhanceRunOperation.Status.FAILED,
        before_geometry=_geom(x="100.00"),
        after_geometry=_geom(x="200.00"),
        patch={"x": "200.00"},
        error_code="save_error",
    )

    result = service.retry(floor=floor, user=user, run_id=source.id)

    assert result.run.kind == EnhanceRun.Kind.RETRY
    assert result.run.applied_count == 1
    assert result.run.status == EnhanceRun.Status.SUCCESS
    assert [o.id for o in result.updated_objects] == [obj.id]
    obj.refresh_from_db()
    assert float(obj.x) == 200.0


@pytest.mark.django_db
def test_retry_unknown_run_raises(service, floor, user):
    with pytest.raises(EnhanceRunNotFoundError):
        service.retry(floor=floor, user=user, run_id=999999)
