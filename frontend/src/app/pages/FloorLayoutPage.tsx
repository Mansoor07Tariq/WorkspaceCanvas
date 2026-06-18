import { lazy, Suspense, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Alert, Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
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
import {
  DEFAULT_GRID_SIZE,
  CANVAS_HEIGHT,
  formatCoordinate,
} from "@/features/layoutObjects/utils/coordinateHelpers";
import { isWallMountedType } from "@/features/layoutObjects/utils/wallPlacement";
import { createLayoutObject } from "@/features/layoutObjects/api/layoutObjectApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { LayoutObjectLibrary } from "@/features/layoutObjects/components/LayoutObjectLibrary";
import { LayoutObjectCreateForm } from "@/features/layoutObjects/components/LayoutObjectCreateForm";
import { LayoutObjectInspector } from "@/features/layoutObjects/components/LayoutObjectInspector";
import { LayoutObjectList } from "@/features/layoutObjects/components/LayoutObjectList";
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

  const { fields, setField, fieldErrors, submission, handleCreate } = useLayoutObjectForm({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    // PR 057 (Error 5): add the created object to local state and select it,
    // instead of refresh() which flips page loading and remounts the canvas.
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
  });

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
                  {isPlacingWallType ? (
                    <Alert severity="info" icon={false}>
                      {c.wallPlacementHint}
                    </Alert>
                  ) : (
                    <LayoutObjectCreateForm
                      fields={fields}
                      fieldErrors={fieldErrors}
                      submissionLoading={submission.loading}
                      submissionError={submission.generalError}
                      onFieldChange={setField}
                      onSubmit={handleCreate}
                    />
                  )}
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
              enhanced={enhanced}
              onEnhancedChange={setEnhanced}
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
                enhanced={enhanced}
                pendingPlacementType={fields.object_type}
                onPlaceObject={handlePlaceObject}
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
                onDeleted={(id) => {
                  // PR 057 (Error 5): remove locally instead of refresh() so the
                  // canvas stays mounted (no page-level loading flip / jerk).
                  removeObjectLocally(id);
                  setSelectedObjectId((current) => (current === id ? null : current));
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
