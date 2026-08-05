from unittest.mock import patch as mock_patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import (
    EnhanceRun,
    EnhanceRunOperation,
    Floor,
    FloorLayoutObject,
    Office,
)
from offices.views import _EnhanceRunBaseView

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def enhance_runs_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/layout-objects/enhance-runs/"


def undo_url(office_id: int, floor_id: int, run_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/enhance-runs/{run_id}/undo/"


def retry_url(office_id: int, floor_id: int, run_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/enhance-runs/{run_id}/retry/"


def _geom(x="100.00", y="100.00", width="50.00", height="50.00", rotation="0.00"):
    return {"x": x, "y": y, "width": width, "height": height, "rotation": rotation}


def _op(object_id, before, after, patch, reason_codes=None):
    return {
        "object_id": object_id,
        "before": before,
        "after": after,
        "patch": patch,
        "reason_codes": reason_codes or [],
    }


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def active_org(db):
    return Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def other_org(db):
    return Organization.objects.create(
        name="Other Corp",
        slug="other-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def active_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Dublin Office", slug="dublin-office"
    )


@pytest.fixture
def other_office(db, other_org):
    return Office.objects.create(
        organization=other_org, name="London Office", slug="london-office"
    )


@pytest.fixture
def floor(db, active_office):
    return Floor.objects.create(office=active_office, name="Ground", slug="ground")


@pytest.fixture
def other_floor(db, other_office):
    return Floor.objects.create(office=other_office, name="Ground", slug="ground")


def _member(org, role, status=Membership.Status.ACTIVE, email="u@example.com"):
    user = User.objects.create_user(
        username=email, email=email, password="Strongpass1!"
    )
    Membership.objects.create(user=user, organization=org, role=role, status=status)
    return user


@pytest.fixture
def owner_client(client, active_org):
    client.force_authenticate(
        user=_member(active_org, MemberRole.OWNER, email="owner@example.com")
    )
    return client


@pytest.fixture
def admin_client(client, active_org):
    client.force_authenticate(
        user=_member(active_org, MemberRole.ADMIN, email="admin@example.com")
    )
    return client


@pytest.fixture
def member_client(client, active_org):
    client.force_authenticate(
        user=_member(active_org, MemberRole.MEMBER, email="member@example.com")
    )
    return client


def _make_obj(
    floor,
    x="100.00",
    y="100.00",
    width="50.00",
    height="50.00",
    rotation="0.00",
    is_active=True,
    object_type="desk",
):
    return FloorLayoutObject.objects.create(
        floor=floor,
        object_type=object_type,
        x=x,
        y=y,
        width=width,
        height=height,
        rotation=rotation,
        is_active=is_active,
    )


# ─── AuthZ ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_owner_can_apply(owner_client, active_office, floor):
    obj = _make_obj(floor)
    body = {
        "plan_id": "plan-1",
        "operations": [
            _op(obj.id, _geom(), _geom(x="200.00"), {"x": "200.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    assert res.data["status"] == "success"
    assert res.data["applied_count"] == 1


@pytest.mark.django_db
def test_admin_can_apply(admin_client, active_office, floor):
    obj = _make_obj(floor)
    body = {
        "plan_id": "plan-admin",
        "operations": [_op(obj.id, _geom(), _geom(x="200.00"), {"x": "200.00"})],
    }
    res = admin_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200


@pytest.mark.django_db
def test_member_cannot_apply(member_client, active_office, floor):
    obj = _make_obj(floor)
    body = {
        "plan_id": "plan-member",
        "operations": [_op(obj.id, _geom(), _geom(x="200.00"), {"x": "200.00"})],
    }
    res = member_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 403
    assert EnhanceRun.objects.count() == 0


@pytest.mark.django_db
def test_unauthenticated_rejected(client, active_office, floor):
    res = client.post(
        enhance_runs_url(active_office.id, floor.id),
        {"plan_id": "x", "operations": []},
        format="json",
    )
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_apply_floor_in_other_org_404(owner_client, active_office, other_floor):
    res = owner_client.post(
        enhance_runs_url(active_office.id, other_floor.id),
        {"plan_id": "x", "operations": [_op(1, _geom(), _geom(), {"x": "1.00"})]},
        format="json",
    )
    assert res.status_code == 404


# ─── Validation ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_missing_plan_id_400(owner_client, active_office, floor):
    obj = _make_obj(floor)
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id),
        {"operations": [_op(obj.id, _geom(), _geom(), {"x": "1.00"})]},
        format="json",
    )
    assert res.status_code == 400
    assert EnhanceRun.objects.count() == 0


@pytest.mark.django_db
def test_empty_operations_400(owner_client, active_office, floor):
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id),
        {"plan_id": "p", "operations": []},
        format="json",
    )
    assert res.status_code == 400
    assert EnhanceRun.objects.count() == 0


# ─── Success / per-op behaviour ──────────────────────────────────────────────


@pytest.mark.django_db
def test_success_all_applied(owner_client, active_office, floor):
    o1 = _make_obj(floor, x="100.00")
    o2 = _make_obj(floor, x="300.00")
    body = {
        "plan_id": "plan-success",
        "operations": [
            _op(o1.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
            _op(o2.id, _geom(x="300.00"), _geom(x="350.00"), {"x": "350.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    assert res.data["status"] == "success"
    assert res.data["applied_count"] == 2
    assert res.data["failed_count"] == 0
    assert res.data["skipped_count"] == 0
    assert len(res.data["updated_objects"]) == 2
    o1.refresh_from_db()
    o2.refresh_from_db()
    assert float(o1.x) == 150.0
    assert float(o2.x) == 350.0


@pytest.mark.django_db
def test_partial_success_invalid_patch(owner_client, active_office, floor):
    good = _make_obj(floor, x="100.00")
    bad = _make_obj(floor, x="300.00")
    body = {
        "plan_id": "plan-partial",
        "operations": [
            _op(good.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
            # invalid: width must be > 0
            _op(bad.id, _geom(x="300.00"), _geom(), {"width": "-5.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    assert res.data["status"] == "partial_success"
    assert res.data["applied_count"] == 1
    assert res.data["failed_count"] == 1
    results = {r["object_id"]: r for r in res.data["operation_results"]}
    assert results[good.id]["status"] == "applied"
    assert results[bad.id]["status"] == "failed"
    assert results[bad.id]["error_code"] == "validation_error"
    bad.refresh_from_db()
    assert float(bad.width) == 50.0  # unchanged (savepoint rolled back)


@pytest.mark.django_db
def test_stale_geometry_skipped(owner_client, active_office, floor):
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-stale",
        "operations": [
            # before says x=999 but actual is 100 -> stale
            _op(obj.id, _geom(x="999.00"), _geom(x="150.00"), {"x": "150.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    assert res.data["skipped_count"] == 1
    r = res.data["operation_results"][0]
    assert r["status"] == "skipped"
    assert r["error_code"] == "stale_geometry"
    obj.refresh_from_db()
    assert float(obj.x) == 100.0


@pytest.mark.django_db
def test_inactive_object_skipped(owner_client, active_office, floor):
    obj = _make_obj(floor, x="100.00", is_active=False)
    body = {
        "plan_id": "plan-inactive",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    r = res.data["operation_results"][0]
    assert r["status"] == "skipped"
    assert r["error_code"] == "object_inactive"


@pytest.mark.django_db
def test_object_not_on_floor_skipped_no_leak(
    owner_client, active_office, floor, other_floor
):
    foreign = _make_obj(other_floor, x="100.00")
    body = {
        "plan_id": "plan-foreign",
        "operations": [
            _op(foreign.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    r = res.data["operation_results"][0]
    assert r["status"] == "skipped"
    assert r["error_code"] == "object_not_available_for_floor"
    assert r["error_message"] == "Object is not available on this floor."
    foreign.refresh_from_db()
    assert float(foreign.x) == 100.0  # untouched cross-tenant


@pytest.mark.django_db
def test_all_invalid_status_failed(owner_client, active_office, floor):
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-allfail",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(), {"width": "-5.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 200
    assert res.data["status"] == "failed"
    assert res.data["applied_count"] == 0


@pytest.mark.django_db
def test_operations_rows_stored(owner_client, active_office, floor):
    o1 = _make_obj(floor, x="100.00")
    o2 = _make_obj(floor, x="300.00", is_active=False)
    body = {
        "plan_id": "plan-rows",
        "operations": [
            _op(o1.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
            _op(o2.id, _geom(x="300.00"), _geom(x="350.00"), {"x": "350.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run = EnhanceRun.objects.get(id=res.data["enhance_run_id"])
    ops = list(EnhanceRunOperation.objects.filter(enhance_run=run))
    assert len(ops) == 2
    assert run.total_operations == 2
    assert run.applied_count == 1
    assert run.skipped_count == 1


# ─── Idempotency ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_idempotent_replay(owner_client, active_office, floor):
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-idem",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
        ],
    }
    res1 = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res1.status_code == 200
    obj.refresh_from_db()
    assert float(obj.x) == 150.0
    first_run_id = res1.data["enhance_run_id"]

    # Replay same plan_id — must NOT re-apply (object not double-moved), and
    # must return the original run's result.
    res2 = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res2.status_code == 200
    assert res2.data["enhance_run_id"] == first_run_id
    obj.refresh_from_db()
    assert float(obj.x) == 150.0  # not moved again

    assert (
        EnhanceRun.objects.filter(
            floor=floor, plan_id="plan-idem", kind="apply"
        ).count()
        == 1
    )


# ─── Undo ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_undo_restores_applied_only(owner_client, active_office, floor):
    applied_obj = _make_obj(floor, x="100.00")
    stale_obj = _make_obj(floor, x="500.00")
    body = {
        "plan_id": "plan-undo",
        "operations": [
            _op(applied_obj.id, _geom(x="100.00"), _geom(x="200.00"), {"x": "200.00"}),
            # stale -> skipped, must not be undone
            _op(stale_obj.id, _geom(x="999.00"), _geom(x="200.00"), {"x": "200.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run_id = res.data["enhance_run_id"]
    applied_obj.refresh_from_db()
    assert float(applied_obj.x) == 200.0

    undo_res = owner_client.post(
        undo_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    assert undo_res.status_code == 200
    assert undo_res.data["applied_count"] == 1
    applied_obj.refresh_from_db()
    assert float(applied_obj.x) == 100.0  # restored

    undo_run = EnhanceRun.objects.get(id=undo_res.data["enhance_run_id"])
    assert undo_run.kind == "undo"
    assert undo_run.parent_run_id == run_id
    # only the applied op was processed
    assert undo_run.total_operations == 1


@pytest.mark.django_db
def test_undo_partial_when_object_missing(owner_client, active_office, floor):
    o1 = _make_obj(floor, x="100.00")
    o2 = _make_obj(floor, x="300.00")
    body = {
        "plan_id": "plan-undo-missing",
        "operations": [
            _op(o1.id, _geom(x="100.00"), _geom(x="200.00"), {"x": "200.00"}),
            _op(o2.id, _geom(x="300.00"), _geom(x="400.00"), {"x": "400.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run_id = res.data["enhance_run_id"]
    # o2 becomes inactive after apply
    o2.is_active = False
    o2.save()

    undo_res = owner_client.post(
        undo_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    assert undo_res.status_code == 200
    assert undo_res.data["status"] == "partial_success"
    assert undo_res.data["applied_count"] == 1
    assert undo_res.data["skipped_count"] == 1
    o1.refresh_from_db()
    assert float(o1.x) == 100.0


# ─── Retry ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_retry_only_failed_ops(owner_client, active_office, floor):
    good = _make_obj(floor, x="100.00")
    bad = _make_obj(floor, x="300.00", width="50.00")
    body = {
        "plan_id": "plan-retry",
        "operations": [
            _op(good.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
            _op(bad.id, _geom(x="300.00"), _geom(width="80.00"), {"width": "-5.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run_id = res.data["enhance_run_id"]
    assert res.data["failed_count"] == 1

    # Fix the bad object's after_geometry intent by updating the stored op patch
    # is not possible from client; retry uses original after_geometry/patch. The
    # original patch (width -5) is still invalid, so retry should fail again but
    # only process the failed op.
    retry_res = owner_client.post(
        retry_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    assert retry_res.status_code == 200
    retry_run = EnhanceRun.objects.get(id=retry_res.data["enhance_run_id"])
    assert retry_run.kind == "retry"
    assert retry_run.parent_run_id == run_id
    # only the one failed op was retried
    assert retry_run.total_operations == 1


@pytest.mark.django_db
def test_retry_reattempts_failed_op_that_is_still_invalid(
    owner_client, active_office, floor
):
    # Renamed (was misleadingly "test_retry_succeeds_when_patch_valid" but it
    # asserts failure): a failed op whose patch is still invalid fails again on
    # retry, and exactly one op is processed. See the real success path in
    # test_retry_reapplies_and_succeeds below.
    bad = _make_obj(floor, x="300.00")
    body = {
        "plan_id": "plan-retry-ok",
        "operations": [
            _op(bad.id, _geom(x="300.00"), _geom(x="450.00"), {"width": "-1.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run_id = res.data["enhance_run_id"]
    assert res.data["failed_count"] == 1

    retry_res = owner_client.post(
        retry_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    # patch still invalid -> still failed, but processed exactly one op
    assert retry_res.status_code == 200
    assert retry_res.data["failed_count"] == 1


@pytest.mark.django_db
def test_retry_reapplies_and_succeeds(owner_client, active_office, floor):
    # Real retry-success path (previously uncovered). The initial apply is forced
    # to fail transiently (as a save_error would); the stored patch is valid, so
    # retry re-applies it and the object actually moves.
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-retry-success",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(x="200.00"), {"x": "200.00"}),
        ],
    }
    with mock_patch.object(
        _EnhanceRunBaseView, "_apply_patch", return_value=(False, {"detail": ["boom"]})
    ):
        res = owner_client.post(
            enhance_runs_url(active_office.id, floor.id), body, format="json"
        )
    assert res.data["failed_count"] == 1
    run_id = res.data["enhance_run_id"]
    obj.refresh_from_db()
    assert float(obj.x) == 100.0  # apply failed → not moved

    retry_res = owner_client.post(
        retry_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    assert retry_res.status_code == 200
    assert retry_res.data["applied_count"] == 1
    assert retry_res.data["status"] == "success"
    obj.refresh_from_db()
    assert float(obj.x) == 200.0  # retry applied the valid patch


@pytest.mark.django_db
def test_retry_skips_skipped_ops(owner_client, active_office, floor):
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-retry-skip",
        "operations": [
            # stale -> skipped, must NOT be retried
            _op(obj.id, _geom(x="999.00"), _geom(x="150.00"), {"x": "150.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run_id = res.data["enhance_run_id"]
    assert res.data["skipped_count"] == 1

    retry_res = owner_client.post(
        retry_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    assert retry_res.status_code == 200
    retry_run = EnhanceRun.objects.get(id=retry_res.data["enhance_run_id"])
    # no failed ops -> nothing retried
    assert retry_run.total_operations == 0
    assert retry_run.status == "failed"  # applied == 0


@pytest.mark.django_db
def test_undo_run_not_found(owner_client, active_office, floor):
    res = owner_client.post(
        undo_url(active_office.id, floor.id, 99999), {}, format="json"
    )
    assert res.status_code == 404


# ─── BE-4: undo must not clobber manual edits made after the run ──────────────


@pytest.mark.django_db
def test_undo_skips_object_manually_moved_after_apply(
    owner_client, active_office, floor
):
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-undo-stale",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(x="200.00"), {"x": "200.00"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    run_id = res.data["enhance_run_id"]
    obj.refresh_from_db()
    assert float(obj.x) == 200.0

    # User manually drags the object somewhere else AFTER the tidy run.
    obj.x = "350.00"
    obj.save(update_fields=["x", "updated_at"])

    undo_res = owner_client.post(
        undo_url(active_office.id, floor.id, run_id), {}, format="json"
    )
    assert undo_res.status_code == 200
    # The op is skipped as stale, NOT restored to 100 — the manual 350 survives.
    assert undo_res.data["skipped_count"] == 1
    assert undo_res.data["applied_count"] == 0
    op_result = undo_res.data["operation_results"][0]
    assert op_result["status"] == "skipped"
    assert op_result["error_code"] == "stale_geometry"
    obj.refresh_from_db()
    assert float(obj.x) == 350.0  # manual edit preserved


# ─── BE-5: enhance operations may only carry geometry fields ──────────────────


@pytest.mark.django_db
def test_apply_rejects_non_geometry_patch_key(owner_client, active_office, floor):
    obj = _make_obj(floor, object_type="desk")
    body = {
        "plan_id": "plan-badpatch",
        "operations": [
            _op(obj.id, _geom(), _geom(), {"x": "150.00", "object_type": "plant"}),
        ],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 400
    obj.refresh_from_db()
    assert obj.object_type == "desk"  # unchanged; whole request rejected


@pytest.mark.django_db
def test_apply_rejects_non_geometry_before_key(owner_client, active_office, floor):
    obj = _make_obj(floor)
    bad_before = {**_geom(), "label": "not-geometry"}
    body = {
        "plan_id": "plan-badbefore",
        "operations": [_op(obj.id, bad_before, _geom(), {"x": "150.00"})],
    }
    res = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), body, format="json"
    )
    assert res.status_code == 400


# ─── BE-2: apply is atomic — object writes roll back if run creation fails ─────


@pytest.mark.django_db
def test_apply_object_writes_rollback_if_run_persist_fails(
    owner_client, active_office, floor
):
    obj = _make_obj(floor, x="100.00")
    body = {
        "plan_id": "plan-atomic",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(x="200.00"), {"x": "200.00"}),
        ],
    }
    # Force the run/operation bookkeeping to fail AFTER the object write. With the
    # old (split-transaction) code the object would stay moved with no audit row;
    # under BE-2 the whole thing rolls back together.
    with mock_patch.object(
        EnhanceRunOperation.objects, "bulk_create", side_effect=RuntimeError("boom")
    ):
        with pytest.raises(RuntimeError):
            owner_client.post(
                enhance_runs_url(active_office.id, floor.id), body, format="json"
            )
    obj.refresh_from_db()
    assert float(obj.x) == 100.0  # object write rolled back
    assert not EnhanceRun.objects.filter(floor=floor, plan_id="plan-atomic").exists()


@pytest.mark.django_db
def test_real_integrity_error_is_contained_by_the_per_op_savepoint(
    owner_client, active_office, floor
):
    """A GENUINE database IntegrityError mid-batch must not poison the outer
    transaction (BE-2).

    This is the load-bearing proof for the whole best-effort design. It does not
    raise a synthetic Python exception: it makes the middle object's save perform a
    real, failing DB write (a negative width, which violates the
    ``layout_obj_positive_size`` CheckConstraint added in migration 0013). That
    leaves the PostgreSQL connection in a genuinely aborted state — which is exactly
    the condition the per-operation savepoint must contain. A synthetic
    ``raise IntegrityError`` would prove nothing here, because it never touches the
    connection.

    If the savepoint did NOT contain it, the next query on that connection would
    raise TransactionManagementError ("current transaction is aborted") and the op
    AFTER the failure — and the EnhanceRun insert — would blow up.
    """
    first = _make_obj(floor, x="100.00")
    bad = _make_obj(floor, x="200.00")
    last = _make_obj(floor, x="300.00")

    real_save = FloorLayoutObject.save

    def flaky_save(self, *args, **kwargs):
        if self.pk == bad.pk:
            # Bypass serializer validation and hit the DB constraint for real.
            FloorLayoutObject.objects.filter(pk=self.pk).update(width=-1)
            return  # unreachable — the UPDATE above raises IntegrityError
        return real_save(self, *args, **kwargs)

    body = {
        "plan_id": "plan-integrity",
        "operations": [
            _op(first.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
            _op(bad.id, _geom(x="200.00"), _geom(x="250.00"), {"x": "250.00"}),
            _op(last.id, _geom(x="300.00"), _geom(x="350.00"), {"x": "350.00"}),
        ],
    }
    with mock_patch.object(
        FloorLayoutObject, "save", autospec=True, side_effect=flaky_save
    ):
        res = owner_client.post(
            enhance_runs_url(active_office.id, floor.id), body, format="json"
        )

    assert res.status_code == 200
    assert res.data["status"] == "partial_success"
    assert res.data["applied_count"] == 2
    assert res.data["failed_count"] == 1
    assert res.data["skipped_count"] == 0

    results = {r["object_id"]: r for r in res.data["operation_results"]}
    assert results[bad.id]["status"] == "failed"
    assert results[bad.id]["error_code"] == "save_error"
    # BE-9: a generic message, not the raw psycopg constraint text.
    assert results[bad.id]["error_message"] == "Could not save the object."

    # The op BEFORE and the op AFTER the failure both persisted → the savepoint
    # contained the aborted state and the outer transaction stayed usable.
    first.refresh_from_db()
    assert float(first.x) == 150.0
    last.refresh_from_db()
    assert float(last.x) == 350.0

    # The failing object rolled back to its savepoint: neither the patch nor the
    # negative width landed.
    bad.refresh_from_db()
    assert float(bad.x) == 200.0
    assert float(bad.width) == 50.0

    # The audit row committed with the outer transaction, with correct counts.
    run = EnhanceRun.objects.get(id=res.data["enhance_run_id"])
    assert run.applied_count == 2
    assert run.failed_count == 1
    assert run.operations.count() == 3


# ─── Permission denials for undo / retry (previously only apply was covered) ──


def _seed_applied_run(floor, obj, plan_id="p-seed"):
    run = EnhanceRun.objects.create(
        floor=floor,
        kind=EnhanceRun.Kind.APPLY,
        plan_id=plan_id,
        status=EnhanceRun.Status.SUCCESS,
        total_operations=1,
        applied_count=1,
    )
    EnhanceRunOperation.objects.create(
        enhance_run=run,
        object_id=obj.id,
        status=EnhanceRunOperation.Status.APPLIED,
        before_geometry=_geom(x="100.00"),
        after_geometry=_geom(x="200.00"),
        patch={"x": "200.00"},
    )
    return run


@pytest.mark.django_db
def test_member_cannot_undo(member_client, active_office, floor):
    obj = _make_obj(floor, x="200.00")
    run = _seed_applied_run(floor, obj, plan_id="p-undo-perm")
    res = member_client.post(
        undo_url(active_office.id, floor.id, run.id), {}, format="json"
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_member_cannot_retry(member_client, active_office, floor):
    obj = _make_obj(floor, x="200.00")
    run = _seed_applied_run(floor, obj, plan_id="p-retry-perm")
    res = member_client.post(
        retry_url(active_office.id, floor.id, run.id), {}, format="json"
    )
    assert res.status_code == 403


# ─── Idempotent replay with a DIFFERENT payload keeps the first result ────────


@pytest.mark.django_db
def test_idempotent_replay_ignores_different_payload(
    owner_client, active_office, floor
):
    obj = _make_obj(floor, x="100.00")
    first = {
        "plan_id": "plan-idem-diff",
        "operations": [
            _op(obj.id, _geom(x="100.00"), _geom(x="150.00"), {"x": "150.00"}),
        ],
    }
    res1 = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), first, format="json"
    )
    assert res1.status_code == 200
    obj.refresh_from_db()
    assert float(obj.x) == 150.0

    # Same plan_id, different operation. The first run wins; the new payload is
    # NOT applied (documented idempotency semantics).
    second = {
        "plan_id": "plan-idem-diff",
        "operations": [
            _op(obj.id, _geom(x="150.00"), _geom(x="900.00"), {"x": "900.00"}),
        ],
    }
    res2 = owner_client.post(
        enhance_runs_url(active_office.id, floor.id), second, format="json"
    )
    assert res2.status_code == 200
    assert res2.data["enhance_run_id"] == res1.data["enhance_run_id"]
    obj.refresh_from_db()
    assert float(obj.x) == 150.0  # not moved to 900
