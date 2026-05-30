import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  buildMovePatch,
  buildTransformPatch,
} from "@/features/layoutObjects/utils/coordinateHelpers";
import { LayoutObjectLibrary } from "@/features/layoutObjects/components/LayoutObjectLibrary";
import { LayoutObjectCreateForm } from "@/features/layoutObjects/components/LayoutObjectCreateForm";
import { LayoutObjectInspector } from "@/features/layoutObjects/components/LayoutObjectInspector";
import { LayoutObjectList } from "@/features/layoutObjects/components/LayoutObjectList";
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

  const { objects, loading, error, refresh, updateObjectLocally, setSaving, savingObjectIds } =
    useLayoutObjects(isNaN(officeId) ? 0 : officeId, isNaN(floorId) ? 0 : floorId);

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

  // These helpers are regular functions — not hooks — so they can appear anywhere.
  // Defined before the early return so the useCallback deps can reference them safely.
  function flashSaved(id: number) {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setSavedObjectId(id);
    savedTimeoutRef.current = setTimeout(() => setSavedObjectId(null), SAVED_DISPLAY_MS);
  }

  function buildMoveError(err: unknown): string {
    return err instanceof ApiError && err.status === 403 ? c.movePermissionError : c.moveError;
  }

  // All useCallback hooks must appear before any early return (Rules of Hooks).
  const handleObjectMove = useCallback(
    async (objectId: number, newX: number, newY: number) => {
      if (savingObjectIds.has(objectId)) return;
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

      const patch = buildMovePatch(newX, newY);
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

  const handleObjectTransform = useCallback(
    async (
      objectId: number,
      newX: number,
      newY: number,
      newWidth: number,
      newHeight: number,
      newRotation: number
    ) => {
      if (savingObjectIds.has(objectId)) return;
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

      const patch = buildTransformPatch(newX, newY, newWidth, newHeight, newRotation);
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
    [officeId, floorId, objects, savingObjectIds, updateObjectLocally, setSaving]
  );

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selectedObjectId || !canManageLayout) return;
      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (!isArrow) return;
      if (e.repeat) return; // ignore auto-repeat to prevent PATCH flooding
      e.preventDefault();
      const step = e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP;
      const obj = objects.find((o) => o.id === selectedObjectId);
      if (!obj) return;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      handleObjectMove(selectedObjectId, parseFloat(obj.x) + dx, parseFloat(obj.y) + dy);
    },
    [selectedObjectId, canManageLayout, objects, handleObjectMove]
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
      role="img"
      aria-label={c.canvasAriaLabel}
      sx={{
        height: CANVAS_HEIGHT_APPROX,
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
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
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
          {c.keyboardHint}
        </Typography>
      )}

      <Box sx={{ flex: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
          {/* Left: library + create form (owners/admins only) */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
              <LayoutObjectLibrary
                selectedType={fields.object_type}
                onSelect={(type: LayoutObjectType) => setField("object_type", type)}
              />
              {canManageLayout && (
                <LayoutObjectCreateForm
                  fields={fields}
                  fieldErrors={fieldErrors}
                  submissionLoading={submission.loading}
                  submissionError={submission.generalError}
                  onFieldChange={setField}
                  onSubmit={handleCreate}
                />
              )}
            </Stack>
          </Grid>

          {/* Center: floor map canvas (lazy-loaded) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Suspense fallback={canvasFallback}>
              <FloorMapCanvas
                objects={objects}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
                canManageLayout={canManageLayout}
                onObjectDragEnd={handleObjectMove}
                onObjectTransformEnd={handleObjectTransform}
                savingObjectIds={savingObjectIds}
                onKeyDown={handleCanvasKeyDown}
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
              />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

// Approximate canvas height used for the Suspense fallback placeholder
const CANVAS_HEIGHT_APPROX = 640;
