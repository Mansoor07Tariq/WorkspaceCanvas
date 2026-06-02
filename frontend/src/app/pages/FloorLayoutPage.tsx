import { lazy, Suspense, useMemo, useState } from "react";
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
import { useCanvasInteractions } from "@/features/layoutObjects/hooks/useCanvasInteractions";
import { DEFAULT_GRID_SIZE, CANVAS_HEIGHT } from "@/features/layoutObjects/utils/coordinateHelpers";
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

  const { user } = useAuth();
  const membership = getFirstActiveMembership(user);
  const canManageLayout = canManageWorkspaceContent(membership?.role);

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

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
