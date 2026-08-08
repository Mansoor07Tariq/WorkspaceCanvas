"""Service layer for layout-enhancement runs (apply / undo / retry).

This module owns the full orchestration that previously lived inline in the
three enhance views (``EnhanceRunListCreateView``, ``EnhanceRunUndoView``,
``EnhanceRunRetryView``). It is deliberately free of any DRF request/response
coupling so the same behaviour can be driven from a non-HTTP caller (a future
bot integration) — the point of the extraction (TD-052).

Contract
--------
Inputs (all callers):
  * ``floor``      — the resolved, permission-checked ``Floor`` the run targets.
                     Authorization is the caller's responsibility; the service
                     assumes the caller may act on this floor.
  * ``user``       — the acting user, recorded as ``EnhanceRun.triggered_by``.
  * apply also takes ``plan_id`` (idempotency key), the validated ``operations``
    list (each: ``object_id`` / ``before`` / ``patch`` / ``reason_codes``), and
    optional ``diagnostics`` / ``summary`` blobs.
  * undo / retry take ``run_id`` — the id of the source run on ``floor``.

Output:
  * ``EnhanceRunResult(run, updated_objects)`` for every path — a fresh apply,
    an idempotent replay of a prior apply, an undo, or a retry. ``run`` is the
    persisted ``EnhanceRun``; ``updated_objects`` is the list of
    ``FloorLayoutObject`` rows whose geometry was actually written (in apply
    order), for the caller to serialise.

Errors:
  * ``EnhanceRunNotFoundError`` — undo/retry referenced a ``run_id`` that does
    not exist on ``floor``. The HTTP layer maps this to 404.

Transaction guarantees (unchanged from the original views, BE-2):
  * Apply/undo/retry wrap ALL object writes AND the run + operation bookkeeping
    in ONE outer ``transaction.atomic()``, so a crash can never leave objects
    moved with no audit record.
  * Each individual operation runs in its own nested savepoint, so a single bad
    object rolls back only itself — best-effort, per-operation semantics.
  * Apply is idempotent on ``(floor, plan_id, kind=APPLY)``: a prior run with the
    same plan_id wins and is replayed without re-applying; a concurrent apply
    that loses the unique-constraint race (``IntegrityError``) rolls the whole
    transaction back and replays the winner.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from decimal import InvalidOperation

from django.db import IntegrityError, transaction

from offices.models import EnhanceRun, EnhanceRunOperation, FloorLayoutObject
from offices.serializers import UpdateLayoutObjectSerializer

logger = logging.getLogger(__name__)

_GEOMETRY_FIELDS = ("x", "y", "width", "height", "rotation")
_ERR_NOT_AVAILABLE = "object_not_available_for_floor"
_MSG_NOT_AVAILABLE = "Object is not available on this floor."
_ERR_INACTIVE = "object_inactive"
_MSG_INACTIVE = "Object is inactive."
_ERR_STALE = "stale_geometry"
_MSG_STALE = "Object changed since the plan was generated."
_ERR_VALIDATION = "validation_error"
_ERR_SAVE = "save_error"
# BE-9: the generic save-failure path returns this stable message to the client
# (and persists it in the audit trail) instead of raw exception text; the real
# exception is logged server-side only.
_MSG_SAVE = "Could not save the object."


class EnhanceRunNotFoundError(Exception):
    """Raised when undo/retry references a run id not present on the floor."""


class _PatchInvalid(Exception):
    """Internal: signals a layout-object patch failed serializer validation,
    so the per-op savepoint rolls back cleanly."""

    def __init__(self, errors):
        super().__init__(str(errors))
        self.errors = errors


@dataclass
class EnhanceRunResult:
    """The outcome of an apply/undo/retry: the persisted run plus the objects
    whose geometry was written (in apply order), for the caller to serialise."""

    run: EnhanceRun
    updated_objects: list[FloorLayoutObject]


def _fmt_dp(value) -> str:
    """Format a numeric/Decimal/str geometry value as a 2-decimal string."""
    return f"{float(value):.2f}"


def _current_geometry(obj: FloorLayoutObject) -> dict[str, str]:
    return {field: _fmt_dp(getattr(obj, field)) for field in _GEOMETRY_FIELDS}


def _geometry_matches(obj: FloorLayoutObject, before: dict) -> bool:
    """True when the object's current geometry matches ``before`` at 2dp.

    Only fields present in ``before`` are compared. A field that cannot be
    parsed as a number counts as a mismatch (stale/invalid).
    """
    for field in _GEOMETRY_FIELDS:
        if field not in before:
            continue
        try:
            expected = _fmt_dp(before[field])
        except (TypeError, ValueError, InvalidOperation):
            return False
        if _fmt_dp(getattr(obj, field)) != expected:
            return False
    return True


def _patch_from_geometry(geometry: dict) -> dict:
    """Build a layout-object patch dict from a geometry dict (geometry fields only)."""
    return {f: geometry[f] for f in _GEOMETRY_FIELDS if f in geometry}


def _run_status(applied: int, failed: int, skipped: int) -> str:
    if applied > 0:
        if failed == 0 and skipped == 0:
            return EnhanceRun.Status.SUCCESS
        return EnhanceRun.Status.PARTIAL_SUCCESS
    if failed > 0:
        return EnhanceRun.Status.FAILED
    if skipped > 0:
        # BE-12: nothing applied and nothing failed — every op was a no-op
        # (already tidy / stale / not on this floor). That is not a failure.
        return EnhanceRun.Status.SKIPPED
    return EnhanceRun.Status.FAILED  # empty run (no operations processed)


class EnhanceRunService:
    """Orchestrates apply/undo/retry of layout-enhancement runs on a floor.

    Stateless — construct one per call (or reuse; instances hold no state).
    Every public method returns an :class:`EnhanceRunResult`. The service takes
    no DRF request object: authorization and serializer validation happen in the
    caller (the view), and this class does only the persistence + geometry work.
    See the module docstring for the full contract and transaction guarantees.
    """

    # ─── Public API ───────────────────────────────────────────────────────────

    def apply(
        self,
        *,
        floor,
        user,
        plan_id: str,
        operations: list,
        diagnostics: list | None = None,
        summary: dict | None = None,
    ) -> EnhanceRunResult:
        """Apply a batch of enhancement operations to ``floor`` (best-effort,
        per-operation, idempotent on ``plan_id``)."""
        # Idempotency: a prior apply with this plan_id on this floor wins —
        # rebuild and return its result without re-applying.
        existing = EnhanceRun.objects.filter(
            floor=floor, plan_id=plan_id, kind=EnhanceRun.Kind.APPLY
        ).first()
        if existing is not None:
            return self._replay(floor, existing)

        # Load all floor objects once (incl. inactive) to distinguish inactive
        # from not-on-floor.
        objmap = {o.id: o for o in FloorLayoutObject.objects.filter(floor=floor)}

        op_rows: list[EnhanceRunOperation] = []
        updated_objects: list[FloorLayoutObject] = []

        # BE-2: the object writes AND the EnhanceRun/operation bookkeeping are
        # wrapped in ONE outer transaction, so a crash (or a duplicate-plan_id
        # IntegrityError on the run insert) can never leave objects moved with no
        # audit record. Each operation still runs in its own nested savepoint so a
        # single bad object rolls back only itself (best-effort semantics intact).
        try:
            with transaction.atomic():
                for op in operations:
                    object_id = op["object_id"]
                    before = op["before"]
                    patch = op["patch"]
                    reason_codes = op.get("reason_codes", [])
                    row = EnhanceRunOperation(
                        object_id=object_id,
                        before_geometry=before,
                        patch=patch,
                        reason_codes=reason_codes,
                    )

                    obj = objmap.get(object_id)
                    if obj is None:
                        row.status = EnhanceRunOperation.Status.SKIPPED
                        row.error_code = _ERR_NOT_AVAILABLE
                        row.error_message = _MSG_NOT_AVAILABLE
                    elif not obj.is_active:
                        row.status = EnhanceRunOperation.Status.SKIPPED
                        row.error_code = _ERR_INACTIVE
                        row.error_message = _MSG_INACTIVE
                    elif not _geometry_matches(obj, before):
                        row.status = EnhanceRunOperation.Status.SKIPPED
                        row.error_code = _ERR_STALE
                        row.error_message = _MSG_STALE
                    elif self._run_geometry_patch(obj, patch, row):
                        updated_objects.append(obj)
                    op_rows.append(row)

                applied = sum(
                    1 for r in op_rows if r.status == EnhanceRunOperation.Status.APPLIED
                )
                failed = sum(
                    1 for r in op_rows if r.status == EnhanceRunOperation.Status.FAILED
                )
                skipped = sum(
                    1 for r in op_rows if r.status == EnhanceRunOperation.Status.SKIPPED
                )

                run = EnhanceRun.objects.create(
                    floor=floor,
                    triggered_by=user,
                    kind=EnhanceRun.Kind.APPLY,
                    plan_id=plan_id,
                    status=_run_status(applied, failed, skipped),
                    total_operations=len(op_rows),
                    applied_count=applied,
                    failed_count=failed,
                    skipped_count=skipped,
                    diagnostics=diagnostics if diagnostics is not None else [],
                    summary=summary if summary is not None else {},
                )
                for row in op_rows:
                    row.enhance_run = run
                EnhanceRunOperation.objects.bulk_create(op_rows)
        except IntegrityError:
            # Concurrent apply with the same plan_id won the unique constraint —
            # the whole transaction (object writes included) rolled back; treat as
            # idempotent and return the winning run's result.
            existing = EnhanceRun.objects.filter(
                floor=floor, plan_id=plan_id, kind=EnhanceRun.Kind.APPLY
            ).first()
            if existing is not None:
                return self._replay(floor, existing)
            raise

        return EnhanceRunResult(run, updated_objects)

    def undo(self, *, floor, user, run_id: int) -> EnhanceRunResult:
        """Undo a prior run by restoring each applied operation's before_geometry.

        A staleness guard (BE-4) skips any object whose current geometry no longer
        matches what the original run left it at (``after_geometry``) — i.e. the
        user manually moved/resized it after the run — so undo never silently
        clobbers intervening manual edits. Such operations are reported as
        ``skipped`` with a ``stale_geometry`` reason instead of being overwritten.
        """
        source = EnhanceRun.objects.filter(floor=floor, id=run_id).first()
        if source is None:
            raise EnhanceRunNotFoundError()

        objmap = {o.id: o for o in FloorLayoutObject.objects.filter(floor=floor)}
        op_rows: list[EnhanceRunOperation] = []
        updated_objects: list[FloorLayoutObject] = []

        # BE-2: object writes + run bookkeeping in one outer transaction.
        with transaction.atomic():
            for src_op in source.operations.all():
                if src_op.status != EnhanceRunOperation.Status.APPLIED:
                    continue
                target = src_op.before_geometry or {}
                patch = _patch_from_geometry(target)
                row = EnhanceRunOperation(
                    object_id=src_op.object_id,
                    patch=patch,
                    reason_codes=["undo"],
                )
                obj = objmap.get(src_op.object_id)
                if obj is None:
                    row.status = EnhanceRunOperation.Status.SKIPPED
                    row.error_code = _ERR_NOT_AVAILABLE
                    row.error_message = _MSG_NOT_AVAILABLE
                    row.before_geometry = {}
                elif not obj.is_active:
                    row.status = EnhanceRunOperation.Status.SKIPPED
                    row.error_code = _ERR_INACTIVE
                    row.error_message = _MSG_INACTIVE
                    row.before_geometry = _current_geometry(obj)
                elif src_op.after_geometry and not _geometry_matches(
                    obj, src_op.after_geometry
                ):
                    # BE-4: the object was edited since the run — skip, don't clobber.
                    row.status = EnhanceRunOperation.Status.SKIPPED
                    row.error_code = _ERR_STALE
                    row.error_message = _MSG_STALE
                    row.before_geometry = _current_geometry(obj)
                else:
                    row.before_geometry = _current_geometry(obj)
                    if self._run_geometry_patch(obj, patch, row):
                        updated_objects.append(obj)
                op_rows.append(row)

            return self._finalize(
                floor,
                user,
                EnhanceRun.Kind.UNDO,
                source,
                op_rows,
                updated_objects,
            )

    def retry(self, *, floor, user, run_id: int) -> EnhanceRunResult:
        """Retry the failed operations of a prior run, re-attempting their patches."""
        source = EnhanceRun.objects.filter(floor=floor, id=run_id).first()
        if source is None:
            raise EnhanceRunNotFoundError()

        objmap = {o.id: o for o in FloorLayoutObject.objects.filter(floor=floor)}
        op_rows: list[EnhanceRunOperation] = []
        updated_objects: list[FloorLayoutObject] = []

        # BE-2: object writes + run bookkeeping in one outer transaction.
        with transaction.atomic():
            for src_op in source.operations.all():
                if src_op.status != EnhanceRunOperation.Status.FAILED:
                    continue
                # Re-attempt the intended target. Prefer the original patch; fall
                # back to the after_geometry fields when the patch is empty. No
                # stale check on retry — the failure was object-level, not staleness.
                patch = src_op.patch or _patch_from_geometry(
                    src_op.after_geometry or {}
                )
                row = EnhanceRunOperation(
                    object_id=src_op.object_id,
                    patch=patch,
                    reason_codes=src_op.reason_codes,
                )
                obj = objmap.get(src_op.object_id)
                if obj is None:
                    row.status = EnhanceRunOperation.Status.SKIPPED
                    row.error_code = _ERR_NOT_AVAILABLE
                    row.error_message = _MSG_NOT_AVAILABLE
                    row.before_geometry = {}
                elif not obj.is_active:
                    row.status = EnhanceRunOperation.Status.SKIPPED
                    row.error_code = _ERR_INACTIVE
                    row.error_message = _MSG_INACTIVE
                    row.before_geometry = _current_geometry(obj)
                else:
                    row.before_geometry = _current_geometry(obj)
                    if self._run_geometry_patch(obj, patch, row):
                        updated_objects.append(obj)
                op_rows.append(row)

            return self._finalize(
                floor,
                user,
                EnhanceRun.Kind.RETRY,
                source,
                op_rows,
                updated_objects,
            )

    # ─── Internals ────────────────────────────────────────────────────────────

    def _replay(self, floor, run: EnhanceRun) -> EnhanceRunResult:
        """Rebuild the result of an already-persisted apply run without
        re-applying anything (idempotent replay). Reused by both the up-front
        plan_id hit and the concurrent-IntegrityError loser path."""
        applied_ids = [
            op.object_id
            for op in run.operations.all()
            if op.status == EnhanceRunOperation.Status.APPLIED
        ]
        objmap = {
            o.id: o
            for o in FloorLayoutObject.objects.filter(floor=floor, id__in=applied_ids)
        }
        updated_objects = [objmap[i] for i in applied_ids if i in objmap]
        return EnhanceRunResult(run, updated_objects)

    def _apply_patch(self, obj: FloorLayoutObject, patch: dict):
        """Validate + save a patch onto obj. Returns (ok, errors). Caller is
        responsible for the per-op savepoint. Mirrors the layout-object update
        view: UpdateLayoutObjectSerializer is a plain Serializer (no update()),
        so we setattr the validated fields and save explicitly."""
        serializer = UpdateLayoutObjectSerializer(
            instance=obj, data=patch, partial=True
        )
        if not serializer.is_valid():
            return False, serializer.errors
        for field, value in serializer.validated_data.items():
            setattr(obj, field, value)
        obj.save()
        return True, None

    def _run_geometry_patch(
        self, obj: FloorLayoutObject, patch: dict, row: EnhanceRunOperation
    ) -> bool:
        """Apply one geometry patch inside a nested savepoint (best-effort).

        Shared by apply/undo/retry (BE-6) so the per-operation execution logic
        lives in exactly one place. Mutates ``row`` (status / error / after
        geometry). Returns True iff the operation APPLIED. The caller MUST already
        be inside an outer ``transaction.atomic()`` so the savepoint is meaningful
        and a single failed op rolls back only itself (BE-2).
        """
        try:
            with transaction.atomic():
                ok, errors = self._apply_patch(obj, patch)
                if not ok:
                    raise _PatchInvalid(errors)
                row.status = EnhanceRunOperation.Status.APPLIED
                row.after_geometry = _current_geometry(obj)
                return True
        except _PatchInvalid as exc:
            row.status = EnhanceRunOperation.Status.FAILED
            row.error_code = _ERR_VALIDATION
            # Serializer field errors are user-facing validation feedback (safe).
            row.error_message = str(exc.errors)
            return False
        except Exception:  # noqa: BLE001 - record, do not crash the batch
            # BE-9: log the real exception server-side; return a generic message.
            logger.exception(
                "Enhance operation save failed for object %s",
                getattr(obj, "id", "?"),
            )
            row.status = EnhanceRunOperation.Status.FAILED
            row.error_code = _ERR_SAVE
            row.error_message = _MSG_SAVE
            return False

    def _finalize(
        self, floor, user, kind, source, op_rows, updated_objects
    ) -> EnhanceRunResult:
        """Create the EnhanceRun + operation rows for a derived (undo/retry)
        run and return its result."""
        applied = sum(
            1 for r in op_rows if r.status == EnhanceRunOperation.Status.APPLIED
        )
        failed = sum(
            1 for r in op_rows if r.status == EnhanceRunOperation.Status.FAILED
        )
        skipped = sum(
            1 for r in op_rows if r.status == EnhanceRunOperation.Status.SKIPPED
        )
        with transaction.atomic():
            run = EnhanceRun.objects.create(
                floor=floor,
                triggered_by=user,
                kind=kind,
                parent_run=source,
                plan_id=uuid.uuid4().hex,
                status=_run_status(applied, failed, skipped),
                total_operations=len(op_rows),
                applied_count=applied,
                failed_count=failed,
                skipped_count=skipped,
            )
            for row in op_rows:
                row.enhance_run = run
            EnhanceRunOperation.objects.bulk_create(op_rows)
        return EnhanceRunResult(run, updated_objects)
