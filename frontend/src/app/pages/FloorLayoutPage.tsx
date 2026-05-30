import { useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { en } from "@/i18n/en";
import { ROUTES, officeDetailPath } from "@/routes/paths";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useLayoutObjectForm } from "@/features/layoutObjects/hooks/useLayoutObjectForm";
import { LayoutObjectLibrary } from "@/features/layoutObjects/components/LayoutObjectLibrary";
import { LayoutObjectCreateForm } from "@/features/layoutObjects/components/LayoutObjectCreateForm";
import { FloorMapCanvas } from "@/features/layoutObjects/components/FloorMapCanvas";
import { LayoutObjectInspector } from "@/features/layoutObjects/components/LayoutObjectInspector";
import { LayoutObjectList } from "@/features/layoutObjects/components/LayoutObjectList";
import type { LayoutObjectType } from "@/features/layoutObjects/types/layoutObject.types";

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

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

  const { objects, loading, error, refresh } = useLayoutObjects(
    isNaN(officeId) ? 0 : officeId,
    isNaN(floorId) ? 0 : floorId
  );

  const { fields, setField, fieldErrors, submission, handleCreate } = useLayoutObjectForm({
    officeId: isNaN(officeId) ? 0 : officeId,
    floorId: isNaN(floorId) ? 0 : floorId,
    onCreated: () => refresh(),
  });

  if (isNaN(officeId) || isNaN(floorId)) {
    return <Navigate to={ROUTES.offices} replace />;
  }

  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null;

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
      <Box sx={{ flex: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
          {/* Left: library + create form */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
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
            </Stack>
          </Grid>

          {/* Center: canvas */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FloorMapCanvas
              objects={objects}
              selectedObjectId={selectedObjectId}
              onSelectObject={setSelectedObjectId}
            />
          </Grid>

          {/* Right: inspector + list */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={2}>
              <LayoutObjectInspector object={selectedObject} />
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
              />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
