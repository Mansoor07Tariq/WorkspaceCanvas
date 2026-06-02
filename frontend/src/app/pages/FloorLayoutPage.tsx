import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Alert, Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { en } from "@/i18n/en";
import { ROUTES, officeDetailPath } from "@/routes/paths";
import { useAuth } from "@/features/auth";
import {
  getFirstActiveMembership,
  canManageWorkspaceContent,
} from "@/features/organizations/utils/membershipUtils";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useLayoutObjectForm } from "@/features/layoutObjects/hooks/useLayoutObjectForm";
import { updateLayoutObject } from "@/features/layoutObjects/api/layoutObjectApi";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_GRID_SIZE,
  buildMovePatch,
  buildTransformPatch,
  clampObjectPosition,
  clampObjectTransform,
  snapToGrid,
  snapObjectToGrid,
  snapSizeToGrid,
} from "@/features/layoutObjects/utils/coordinateHelpers";
import { LayoutObjectLibrary } from "@/features/layoutObjects/components/LayoutObjectLibrary";
import { LayoutObjectCreateForm } from "@/features/layoutObjects/components/LayoutObjectCreateForm";
import { LayoutObjectInspector } from "@/features/layoutObjects/components/LayoutObjectInspector";
import { LayoutObjectList } from "@/features/layoutObjects/components/LayoutObjectList";
import { LayoutCanvasToolbar } from "@/features/layoutObjects/components/LayoutCanvasToolbar";
import { useDesks } from "@/features/desks/hooks/useDesks";
import { DeskResourcePanel } from "@/features/desks/components/DeskResourcePanel";
import { ApiError } from "@/lib/api/apiClient";
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

const SAVED_DISPLAY_MS = 2000;
const KEYBOARD_STEP = 1;
const KEYBOARD_STEP_SHIFT = 10;

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

  const { user } = useAuth();
  const membership = getFirstActiveMembership(user);
  const canManageLayout = canManageWorkspaceContent(membership?.role);

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [layoutSaveError, setLayoutSaveError] = useState<string | undefined>(undefined);
  const [savedObjectId, setSavedObjectId] = useState<number | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Canvas editor settings (local UI state — not persisted to backend) ───
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);

  const { objects, loading, error, refresh, updateObjectLocally, setSaving, savingObjectIds } =
    useLayoutObjects(isNaN(officeId) ? 0 : officeId, isNaN(floorId) ? 0 : floorId);

  const { desks, refresh: refreshDesks } = useDesks(
    isNaN(officeId) ? 0 : officeId,
    isNaN(floorId) ? 0 : floorId
  );

  const bookableObjectIds = useMemo(
    () => new Set(desks.map((desk) => desk.layout_object)),
    [desks]
  );

  const { fields, setField, fieldErrors, submission, handleCreate } = useLayoutObjectForm({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    onCreated: () => refresh(),
  });

  // Clear saved timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function flashSaved(id: number) {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setSavedObjectId(id);
    savedTimeoutRef.current = setTimeout(() => setSavedObjectId(null), SAVED_DISPLAY_MS);
  }

  function buildMoveError(err: unknown): string {
    return err instanceof ApiError && err.status === 403 ? c.movePermissionError : c.moveError;
  }

  // ─── Core move PATCH — receives final coordinates (already snapped/clamped) ─
  const handleObjectMove = useCallback(
    async (objectId: number, x: number, y: number) => {
      if (savingObjectIds.has(objectId)) return;
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

      const patch = buildMovePatch(x, y);
      updateObjectLocally(objectId, patch);
      setSaving(objectId, true);
      setLayoutSaveError(undefined);

      try {
        await updateLayoutObject(officeId, floorId, objectId, patch);
        flashSaved(objectId);
      } catch (err) {
        updateObjectLocally(objectId, { x: prevObj.x, y: prevObj.y });
        setLayoutSaveError(buildMoveError(err));
      } finally {
        setSaving(objectId, false);
      }
    },
    [officeId, floorId, objects, savingObjectIds, updateObjectLocally, setSaving]
  );

  // ─── Drag-end wrapper — applies snap (both axes) then clamp ───────────────
  const handleObjectDragEnd = useCallback(
    (objectId: number, rawX: number, rawY: number) => {
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;
      const w = parseFloat(prevObj.width);
      const h = parseFloat(prevObj.height);

      // Snap first, then clamp so the final position is always inside canvas
      const { x: sx, y: sy } = snapToGridEnabled
        ? snapObjectToGrid(rawX, rawY, gridSize)
        : { x: rawX, y: rawY };
      const { x, y } = clampObjectPosition(sx, sy, w, h, CANVAS_WIDTH, CANVAS_HEIGHT);

      handleObjectMove(objectId, x, y);
    },
    [objects, snapToGridEnabled, gridSize, handleObjectMove]
  );

  // ─── Transform PATCH — applies snap + clamp then persists ─────────────────
  const handleObjectTransform = useCallback(
    async (
      objectId: number,
      rawX: number,
      rawY: number,
      rawWidth: number,
      rawHeight: number,
      rawRotation: number
    ) => {
      if (savingObjectIds.has(objectId)) return;
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

      // Snap size, then position; then clamp both to canvas
      let w = rawWidth;
      let h = rawHeight;
      let x = rawX;
      let y = rawY;
      if (snapToGridEnabled) {
        const snappedSize = snapSizeToGrid(w, h, gridSize);
        w = snappedSize.width;
        h = snappedSize.height;
        x = snapToGrid(x, gridSize);
        y = snapToGrid(y, gridSize);
      }
      const {
        x: fx,
        y: fy,
        width: fw,
        height: fh,
      } = clampObjectTransform(x, y, w, h, CANVAS_WIDTH, CANVAS_HEIGHT);

      const patch = buildTransformPatch(fx, fy, fw, fh, rawRotation);
      updateObjectLocally(objectId, patch);
      setSaving(objectId, true);
      setLayoutSaveError(undefined);

      try {
        await updateLayoutObject(officeId, floorId, objectId, patch);
        flashSaved(objectId);
      } catch (err) {
        updateObjectLocally(objectId, {
          x: prevObj.x,
          y: prevObj.y,
          width: prevObj.width,
          height: prevObj.height,
          rotation: prevObj.rotation,
        });
        setLayoutSaveError(buildMoveError(err));
      } finally {
        setSaving(objectId, false);
      }
    },
    [
      officeId,
      floorId,
      objects,
      savingObjectIds,
      updateObjectLocally,
      setSaving,
      snapToGridEnabled,
      gridSize,
    ]
  );

  // ─── Keyboard handler — axis-specific snap + clamp ────────────────────────
  //
  // e.repeat is ignored to prevent PATCH flooding (Option A from spec).
  // When snap is enabled the step equals gridSize so one keypress = one grid cell.
  // Snap is applied only to the axis that moved to avoid jumping the perpendicular axis.
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selectedObjectId || !canManageLayout) return;
      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (!isArrow) return;
      if (e.repeat) return;
      e.preventDefault();

      const obj = objects.find((o) => o.id === selectedObjectId);
      if (!obj) return;
      const w = parseFloat(obj.width);
      const h = parseFloat(obj.height);

      const step = snapToGridEnabled ? gridSize : e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

      let rawX = parseFloat(obj.x) + dx;
      let rawY = parseFloat(obj.y) + dy;

      // Snap only the axis that moved — avoids the stationary axis jumping to the grid
      if (snapToGridEnabled) {
        if (dx !== 0) rawX = snapToGrid(rawX, gridSize);
        if (dy !== 0) rawY = snapToGrid(rawY, gridSize);
      }

      const { x, y } = clampObjectPosition(rawX, rawY, w, h, CANVAS_WIDTH, CANVAS_HEIGHT);
      handleObjectMove(selectedObjectId, x, y);
    },
    [selectedObjectId, canManageLayout, objects, handleObjectMove, snapToGridEnabled, gridSize]
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

  if (loading) {
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

      {canManageLayout && selectedObjectId !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ mx: { xs: 2, sm: 3 }, mb: 0.5 }}>
          {snapToGridEnabled ? c.keyboardHintSnap : c.keyboardHint}
        </Typography>
      )}

      <Box sx={{ flex: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
          {/* Left: library + create form (owners/admins only) */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
              {canManageLayout && (
                <>
                  <LayoutObjectLibrary
                    selectedType={fields.object_type}
                    onSelect={(type: LayoutObjectType) => setField("object_type", type)}
                  />
                  <LayoutObjectCreateForm
                    fields={fields}
                    fieldErrors={fieldErrors}
                    submissionLoading={submission.loading}
                    submissionError={submission.generalError}
                    onFieldChange={setField}
                    onSubmit={handleCreate}
                  />
                </>
              )}
            </Stack>
          </Grid>

          {/* Center: toolbar + floor map canvas (canvas lazy-loaded) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <LayoutCanvasToolbar
              showGrid={showGrid}
              onShowGridChange={setShowGrid}
              snapEnabled={snapToGridEnabled}
              onSnapChange={setSnapToGridEnabled}
              gridSize={gridSize}
              onGridSizeChange={setGridSize}
              canManageLayout={canManageLayout}
            />
            <Suspense fallback={canvasFallback}>
              <FloorMapCanvas
                objects={objects}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
                canManageLayout={canManageLayout}
                onObjectDragEnd={handleObjectDragEnd}
                onObjectTransformEnd={handleObjectTransform}
                savingObjectIds={savingObjectIds}
                onKeyDown={handleCanvasKeyDown}
                showGrid={showGrid}
                gridSize={gridSize}
                bookableObjectIds={bookableObjectIds}
              />
            </Suspense>
          </Grid>

          {/* Right: inspector + object list */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
              <LayoutObjectInspector
                object={selectedObject}
                isSaving={isSelectedSaving}
                isSaved={isSelectedSaved}
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
              <LayoutObjectList
                officeId={officeId}
                floorId={floorId}
                objects={objects}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
                onDeleted={() => {
                  setSelectedObjectId(null);
                  refresh();
                }}
                canManageLayout={canManageLayout}
                bookableObjectIds={bookableObjectIds}
              />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
