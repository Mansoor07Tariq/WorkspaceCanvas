import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Alert, Box, Button, Chip, Grid, Snackbar, Stack, Typography } from "@mui/material";
import { ArrowBackOutlined, AutoFixHighOutlined, TuneOutlined } from "@mui/icons-material";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { en } from "@/i18n/en";
import { ROUTES, officeDetailPath } from "@/routes/paths";
import {
  getMembershipForOrganization,
  canManageWorkspaceContent,
} from "@/features/organizations/utils/membershipUtils";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useLayoutObjectForm } from "@/features/layoutObjects/hooks/useLayoutObjectForm";
import { useCanvasInteractions } from "@/features/layoutObjects/hooks/useCanvasInteractions";
import { useFloorBoundary } from "@/features/layoutObjects/hooks/useFloorBoundary";
import { useFloors } from "@/features/floors/hooks/useFloors";
import { useCollapseSidebarWhileMounted } from "@/app/layout/SidebarCollapseContext";
import { getCutoutRects } from "@/features/layoutObjects/utils/floorShape";
import { useEnhanceTidy } from "@/features/layoutObjects/hooks/useEnhanceTidy";
import { EnhanceTidyDialog } from "@/features/layoutObjects/components/EnhanceTidyDialog";
import { useFloorSetupSteps } from "@/features/layoutObjects/wizard/useFloorSetupSteps";
import { useFloorPublish } from "@/features/layoutObjects/wizard/useFloorPublish";
import { FloorSetupStepper } from "@/features/layoutObjects/wizard/FloorSetupStepper";
import { EnhanceTidyPanel } from "@/features/layoutObjects/wizard/EnhanceTidyPanel";
import { FloorReviewPanel } from "@/features/layoutObjects/wizard/FloorReviewPanel";
import { FloorEditConfirmDialog } from "@/features/layoutObjects/wizard/FloorEditConfirmDialog";
import {
  DEFAULT_GRID_SIZE,
  CANVAS_HEIGHT,
  formatCoordinate,
  makeFloorBoundary,
  clampObjectToBoundary,
  type FloorBoundary,
} from "@/features/layoutObjects/utils/coordinateHelpers";
import { isWallMountedType } from "@/features/layoutObjects/utils/wallPlacement";
import { getDefaultSizeForObjectType } from "@/features/layoutObjects/utils/layoutObjectLibrary";
import {
  createLayoutObject,
  updateLayoutObject,
  deleteLayoutObject,
} from "@/features/layoutObjects/api/layoutObjectApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { LayoutObjectLibrary } from "@/features/layoutObjects/components/LayoutObjectLibrary";
import {
  LayoutObjectInspector,
  type InspectorPatch,
} from "@/features/layoutObjects/components/LayoutObjectInspector";
import { LayoutCanvasToolbar } from "@/features/layoutObjects/components/LayoutCanvasToolbar";
import { useDesks } from "@/features/desks/hooks/useDesks";
import { DeskResourcePanel } from "@/features/desks/components/DeskResourcePanel";
import type { LayoutObjectType } from "@/features/layoutObjects/types/layoutObject.types";

// Konva is large — lazy-load so it stays out of the initial bundle
const FloorMapCanvas = lazy(() =>
  import("@/features/layoutObjects/components/FloorMapCanvas").then((m) => ({
    default: m.FloorMapCanvas,
  }))
);

const c = en.app.layoutObjects;
const cf = en.app.floors;

interface FloorRouteState {
  floorName?: string;
  levelNumber?: number;
}

export function FloorLayoutPage() {
  const { officeId: officeIdParam, floorId: floorIdParam } = useParams<{
    officeId: string;
    floorId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const floorState = (location.state as FloorRouteState | null) ?? null;

  const officeId = parseInt(officeIdParam ?? "", 10);
  const floorId = parseInt(floorIdParam ?? "", 10);

  const { activeMemberships, selectedMembership } = useSelectedOrganization();

  // Collapse the app sidebar into a burger on this screen so the canvas gets
  // the full width (the topbar / org switcher stay).
  useCollapseSidebarWhileMounted();

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

  // ─── Canvas editor settings (local UI state — not persisted to backend) ───
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  // When on, the canvas swaps simple boxes for detailed isometric assets.
  const [enhanced, setEnhanced] = useState(false);

  const {
    objects,
    loading,
    error,
    updateObjectLocally,
    addObjectLocally,
    removeObjectLocally,
    setSaving,
    savingObjectIds,
  } = useLayoutObjects(isNaN(officeId) ? 0 : officeId, isNaN(floorId) ? 0 : floorId);

  const { desks, refresh: refreshDesks } = useDesks(
    isNaN(officeId) ? 0 : officeId,
    isNaN(floorId) ? 0 : floorId
  );

  // TD-045: gate layout-editing affordances on the membership for THIS floor's
  // organization (resolved from the loaded desks, which carry their org id), so
  // a multi-org user whose role differs across orgs sees the correct edit vs
  // read-only mode even when this floor is not their selected org. Fall back to
  // the selected membership before data loads / on a floor with no desks yet.
  // Backend enforces the real permission regardless.
  const floorOrganizationId = desks[0]?.organization ?? null;
  const membership =
    getMembershipForOrganization(activeMemberships, floorOrganizationId) ?? selectedMembership;
  const canManageLayout = canManageWorkspaceContent(membership?.role);

  const bookableObjectIds = useMemo(
    () => new Set(desks.map((desk) => desk.layout_object)),
    [desks]
  );

  // ─── Editable, persisted floor boundary ───────────────────────────────────
  // The boundary feeds both the canvas (walls/containment) and useCanvasInteractions
  // (clamping). On resize-settle we reflow objects left outside a shrunken room;
  // a ref breaks the cycle between the two hooks (reflow lives in the other one).
  const { floors, refresh: refreshFloors } = useFloors(isNaN(officeId) ? 0 : officeId);
  const floor = floors.find((f) => f.id === floorId);
  const reflowRef = useRef<((b: FloorBoundary) => void) | null>(null);
  // Stable so it doesn't re-create the boundary hook's resize callback each render.
  const handleResizeSettled = useCallback((b: FloorBoundary) => reflowRef.current?.(b), []);
  const {
    boundary,
    resizeBoundary,
    saveError: boundarySaveError,
  } = useFloorBoundary({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    floor,
    canManage: canManageLayout,
    onResizeSettled: handleResizeSettled,
  });

  // The library now adds objects directly (no create form); we keep this hook
  // only for the door/window placement "pending type" (set via setField).
  const { fields, setField } = useLayoutObjectForm({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    onCreated: (obj) => {
      addObjectLocally(obj);
      setSelectedObjectId(obj.id);
    },
  });

  // TD-019: canvas interaction logic lives in a dedicated, unit-tested hook.
  const {
    handleObjectDragEnd,
    handleObjectTransform,
    handleCanvasKeyDown,
    reflowObjectsIntoBoundary,
    applyBoundaryResize,
    layoutSaveError,
    setLayoutSaveError,
    savedObjectId,
  } = useCanvasInteractions({
    officeId,
    floorId,
    objects,
    selectedObjectId,
    canManageLayout,
    snapEnabled: snapToGridEnabled,
    gridSize,
    savingObjectIds,
    updateObjectLocally,
    setSaving,
    boundary,
    enhanced,
  });
  // Keep the reflow ref current so a settled resize can pull objects back inside.
  useEffect(() => {
    reflowRef.current = reflowObjectsIntoBoundary;
  }, [reflowObjectsIntoBoundary]);

  // Resize the room: apply the change to the contents (carry boundary-wall
  // openings onto the moved walls and shift the rest by the origin delta), then
  // commit + persist the new dimensions. shiftX/shiftY default to 0 (numeric edits
  // and bottom/right drags grow from the fixed top-left).
  const handleBoundaryResize = useCallback(
    (width: number, height: number, shiftX = 0, shiftY = 0) => {
      applyBoundaryResize(boundary, makeFloorBoundary(width, height), shiftX, shiftY);
      resizeBoundary(width, height);
    },
    [boundary, applyBoundaryResize, resizeBoundary]
  );

  // Tidy layout — an EXPLICIT admin action (PR 063), fully decoupled from the
  // view-only `enhanced` toggle. The pure engine computes a plan; the admin
  // previews it; applying it runs a tracked best-effort backend EnhanceRun that
  // can be undone/retried. The isometric toggle never mutates the layout.
  const buildTidyInput = useCallback(
    () => ({ boundary, objects, cutouts: getCutoutRects(objects) }),
    [boundary, objects]
  );
  const resyncObjects = useCallback(
    (updated: typeof objects) => {
      for (const o of updated) updateObjectLocally(o.id, o);
    },
    [updateObjectLocally]
  );
  const tidy = useEnhanceTidy({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    buildInput: buildTidyInput,
    onObjectsUpdated: resyncObjects,
  });

  // ─── Floor setup wizard (PR 064) ───────────────────────────────────────────
  // The guided flow is the default for managers; "Free editing" drops the
  // stepper. `floor.status` is the persisted lifecycle (draft while building →
  // published on finish); the Review step is read-only and offers Publish/Edit.
  const [wizardMode, setWizardMode] = useState(true);
  const steps = useFloorSetupSteps();
  const showWizard = canManageLayout && wizardMode;
  const reviewLocked = showWizard && steps.stepId === "review";
  const floorStatus = floor?.status ?? "draft";
  const [toast, setToast] = useState<string | null>(null);

  const publish = useFloorPublish({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    onChanged: () => refreshFloors(),
  });

  // A published floor opens on the read-only Review step the first time it loads.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !floor || !canManageLayout) return;
    startedRef.current = true;
    if (floor.status === "published") steps.goTo("review");
  }, [floor, canManageLayout, steps]);

  // Compute the Tidy preview automatically when the admin reaches the Tidy step.
  useEffect(() => {
    if (showWizard && steps.stepId === "tidy" && tidy.phase === "idle") tidy.openPreview();
  }, [showWizard, steps.stepId, tidy]);

  const handlePublish = useCallback(async () => {
    await publish.publish();
    setToast(c.wizard.publishedToast);
  }, [publish]);

  const handleConfirmEdit = useCallback(async () => {
    await publish.confirmEdit();
    setToast(c.wizard.draftToast);
    steps.goTo("build");
  }, [publish, steps]);

  // PR 061: place a door/window onto a wall by clicking the canvas. Bypasses the
  // manual create form — coordinates come from the hover-snapped placement.
  const handlePlaceObject = async (
    type: LayoutObjectType,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number
  ) => {
    setLayoutSaveError(undefined);
    try {
      const created = await createLayoutObject(officeId, floorId, {
        object_type: type,
        label: "",
        x: formatCoordinate(x),
        y: formatCoordinate(y),
        width: formatCoordinate(width),
        height: formatCoordinate(height),
        rotation: formatCoordinate(rotation),
        is_bookable: false,
      });
      addObjectLocally(created);
      // One click places one door/window: clear the canvas selection and the
      // library selection so placement mode turns off (no chaining placements
      // on every subsequent click).
      setSelectedObjectId(null);
      setField("object_type", "");
    } catch (err) {
      setLayoutSaveError(getApiErrorMessage(err));
    }
  };

  const isPlacingWallType = isWallMountedType(fields.object_type);

  // Add an object straight from the library: drop it near the room centre,
  // select it, and let the user fill in details in the inspector. (Door/window
  // keep click-to-place — see handleLibrarySelect.)
  const handleQuickAdd = useCallback(
    async (type: LayoutObjectType) => {
      setLayoutSaveError(undefined);
      const { width, height } = getDefaultSizeForObjectType(type);
      const cascade = (objects.length % 6) * 16; // avoid exact stacking on repeats
      const cx = boundary.x + boundary.width / 2 - width / 2 + cascade;
      const cy = boundary.y + boundary.height / 2 - height / 2 + cascade;
      const { x, y } = clampObjectToBoundary(cx, cy, width, height, boundary);
      try {
        const created = await createLayoutObject(officeId, floorId, {
          object_type: type,
          label: "",
          x: formatCoordinate(x),
          y: formatCoordinate(y),
          width: formatCoordinate(width),
          height: formatCoordinate(height),
          rotation: "0.00",
          is_bookable: false,
        });
        addObjectLocally(created);
        setSelectedObjectId(created.id);
      } catch (err) {
        setLayoutSaveError(getApiErrorMessage(err));
      }
    },
    [officeId, floorId, objects.length, boundary, addObjectLocally, setLayoutSaveError]
  );

  const handleLibrarySelect = useCallback(
    (type: LayoutObjectType) => {
      if (isWallMountedType(type)) {
        setField("object_type", type); // enter hover-to-place mode on a wall
        return;
      }
      setField("object_type", "");
      void handleQuickAdd(type);
    },
    [setField, handleQuickAdd]
  );

  // Persist inspector edits (label / size / rotation) with optimistic rollback.
  const handleSaveDetails = useCallback(
    async (id: number, patch: InspectorPatch) => {
      const prev = objects.find((o) => o.id === id);
      if (!prev) return;
      const update = {
        label: patch.label,
        width: formatCoordinate(parseFloat(patch.width)),
        height: formatCoordinate(parseFloat(patch.height)),
        rotation: formatCoordinate(parseFloat(patch.rotation)),
      };
      updateObjectLocally(id, update);
      setSaving(id, true);
      setLayoutSaveError(undefined);
      try {
        await updateLayoutObject(officeId, floorId, id, update);
      } catch (err) {
        updateObjectLocally(id, {
          label: prev.label,
          width: prev.width,
          height: prev.height,
          rotation: prev.rotation,
        });
        setLayoutSaveError(getApiErrorMessage(err));
      } finally {
        setSaving(id, false);
      }
    },
    [objects, officeId, floorId, updateObjectLocally, setSaving, setLayoutSaveError]
  );

  const handleDeleteSelected = useCallback(
    async (id: number) => {
      setLayoutSaveError(undefined);
      try {
        await deleteLayoutObject(officeId, floorId, id);
        removeObjectLocally(id);
        setSelectedObjectId((current) => (current === id ? null : current));
      } catch (err) {
        setLayoutSaveError(getApiErrorMessage(err));
      }
    },
    [officeId, floorId, removeObjectLocally, setLayoutSaveError]
  );

  // All hooks complete — now safe to do early returns.
  if (isNaN(officeId) || isNaN(floorId)) {
    return <Navigate to={ROUTES.offices} replace />;
  }

  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null;
  const isSelectedSaving = selectedObjectId !== null && savingObjectIds.has(selectedObjectId);
  const isSelectedSaved = selectedObjectId !== null && savedObjectId === selectedObjectId;

  const canvasFallback = (
    <Box
      role="status"
      aria-label={c.canvasLoading}
      sx={{
        height: CANVAS_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.default",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {c.canvasLoading}
      </Typography>
    </Box>
  );

  const header = (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, pb: 1.5 }}>
      <Button
        startIcon={<ArrowBackOutlined />}
        variant="text"
        size="small"
        onClick={() => navigate(officeDetailPath(officeId))}
        sx={{ mb: 1 }}
      >
        {c.backToFloors}
      </Button>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
          {floorState?.floorName ?? c.pageTitle}
        </Typography>
        {floorState?.levelNumber !== undefined && (
          <Chip
            label={`${cf.level} ${floorState.levelNumber}`}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: "0.7rem" }}
          />
        )}
      </Stack>
    </Box>
  );

  if (error) {
    return (
      <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
        {header}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 2, sm: 4 },
          }}
        >
          <Box sx={{ maxWidth: 480, width: "100%" }}>
            <ErrorAlert message={error} />
            <Button
              variant="text"
              onClick={() => navigate(officeDetailPath(officeId))}
              sx={{ mt: 2 }}
            >
              {c.backToFloors}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // PR 057 (Error 5): only show the full-page loader on the INITIAL load (no
  // objects yet). A later revalidation keeps the canvas mounted so add/delete
  // never swaps the whole page out (the visible "jerk").
  if (loading && objects.length === 0) {
    return (
      <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
        {header}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LoadingState />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {header}

      {!canManageLayout && (
        <Alert severity="info" sx={{ mx: { xs: 2, sm: 3 }, mb: 1 }}>
          {c.readOnlyBanner}
        </Alert>
      )}

      {layoutSaveError && (
        <Alert
          severity="error"
          onClose={() => setLayoutSaveError(undefined)}
          sx={{ mx: { xs: 2, sm: 3 }, mb: 1 }}
        >
          {layoutSaveError}
        </Alert>
      )}

      {boundarySaveError && (
        <Alert severity="error" sx={{ mx: { xs: 2, sm: 3 }, mb: 1 }}>
          {boundarySaveError}
        </Alert>
      )}

      {canManageLayout && selectedObjectId !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ mx: { xs: 2, sm: 3 }, mb: 0.5 }}>
          {snapToGridEnabled ? c.keyboardHintSnap : c.keyboardHint}
        </Typography>
      )}

      {canManageLayout && (
        <Box sx={{ px: { xs: 2, sm: 3 }, mb: 1 }}>
          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Button
              size="small"
              startIcon={showWizard ? <TuneOutlined /> : <AutoFixHighOutlined />}
              onClick={() => setWizardMode((v) => !v)}
            >
              {showWizard ? c.wizard.freeEdit : c.wizard.guidedSetup}
            </Button>
          </Stack>
          {showWizard && (
            <FloorSetupStepper
              activeId={steps.stepId}
              onStep={steps.goTo}
              onNext={steps.next}
              onPrev={steps.prev}
            />
          )}
        </Box>
      )}

      {showWizard && steps.stepId === "openings" && (
        <Alert severity="info" sx={{ mx: { xs: 2, sm: 3 }, mb: 1 }}>
          {c.wizard.openingsHint}
        </Alert>
      )}

      {publish.error && (
        <Alert severity="error" onClose={publish.clearError} sx={{ mx: { xs: 2, sm: 3 }, mb: 1 }}>
          {publish.error === "publishError" ? c.wizard.publishError : c.wizard.unpublishError}
        </Alert>
      )}

      <Box sx={{ flex: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
          {/* Left: step-aware panel (library, Tidy, or Review) */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
              {canManageLayout &&
                (!showWizard || steps.stepId === "build" || steps.stepId === "openings") && (
                  <>
                    <LayoutObjectLibrary
                      selectedType={fields.object_type}
                      onSelect={handleLibrarySelect}
                    />
                    {isPlacingWallType && (
                      <Alert severity="info" icon={false}>
                        {c.wallPlacementHint}
                      </Alert>
                    )}
                  </>
                )}
              {showWizard && steps.stepId === "tidy" && <EnhanceTidyPanel tidy={tidy} />}
              {showWizard && steps.stepId === "review" && (
                <FloorReviewPanel
                  status={floorStatus}
                  busy={publish.busy}
                  onPublish={handlePublish}
                  onEdit={publish.requestEdit}
                />
              )}
            </Stack>
          </Grid>

          {/* Center: toolbar + floor map canvas (canvas lazy-loaded) */}
          <Grid size={{ xs: 12, md: 6 }}>
            {!reviewLocked && (
              <LayoutCanvasToolbar
                showGrid={showGrid}
                onShowGridChange={setShowGrid}
                snapEnabled={snapToGridEnabled}
                onSnapChange={setSnapToGridEnabled}
                gridSize={gridSize}
                onGridSizeChange={setGridSize}
                canManageLayout={canManageLayout}
                enhanced={enhanced}
                onEnhancedChange={setEnhanced}
                onTidy={!showWizard && canManageLayout ? tidy.openPreview : undefined}
                boundaryWidth={boundary.width}
                boundaryHeight={boundary.height}
                onBoundaryWidthChange={(w) => handleBoundaryResize(w, boundary.height)}
                onBoundaryHeightChange={(h) => handleBoundaryResize(boundary.width, h)}
              />
            )}
            <Suspense fallback={canvasFallback}>
              <FloorMapCanvas
                objects={objects}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
                canManageLayout={reviewLocked ? false : canManageLayout}
                onObjectDragEnd={handleObjectDragEnd}
                onObjectTransformEnd={handleObjectTransform}
                savingObjectIds={savingObjectIds}
                onKeyDown={handleCanvasKeyDown}
                showGrid={showGrid}
                gridSize={gridSize}
                bookableObjectIds={bookableObjectIds}
                enhanced={reviewLocked ? true : enhanced}
                boundary={boundary}
                onBoundaryResize={
                  reviewLocked ? undefined : canManageLayout ? handleBoundaryResize : undefined
                }
                pendingPlacementType={fields.object_type}
                onPlaceObject={handlePlaceObject}
              />
            </Suspense>
            {!showWizard && <EnhanceTidyDialog tidy={tidy} />}
          </Grid>

          {/* Right: details for the object selected on the canvas */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
              <LayoutObjectInspector
                object={selectedObject}
                isSaving={isSelectedSaving}
                isSaved={isSelectedSaved}
                canEdit={canManageLayout && !reviewLocked}
                onSave={
                  selectedObject
                    ? (patch) => handleSaveDetails(selectedObject.id, patch)
                    : undefined
                }
                onDelete={
                  selectedObject ? () => void handleDeleteSelected(selectedObject.id) : undefined
                }
              />
              <DeskResourcePanel
                key={selectedObject?.id ?? "none"}
                selectedObject={selectedObject}
                desks={desks}
                officeId={officeId}
                floorId={floorId}
                canManageLayout={canManageLayout}
                onDeskCreated={refreshDesks}
                onDeskUpdated={refreshDesks}
                onDeskDeleted={refreshDesks}
              />
            </Stack>
          </Grid>
        </Grid>
      </Box>

      <FloorEditConfirmDialog
        open={publish.confirmEditOpen}
        busy={publish.busy}
        onCancel={publish.cancelEdit}
        onConfirm={handleConfirmEdit}
      />
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
