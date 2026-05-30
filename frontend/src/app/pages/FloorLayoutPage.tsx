import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { en } from "@/i18n/en";
import { ROUTES, officeDetailPath } from "@/routes/paths";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useLayoutObjectForm } from "@/features/layoutObjects/hooks/useLayoutObjectForm";
import { LayoutObjectEmptyState } from "@/features/layoutObjects/components/LayoutObjectEmptyState";
import { LayoutObjectLibrary } from "@/features/layoutObjects/components/LayoutObjectLibrary";
import { LayoutObjectCreateForm } from "@/features/layoutObjects/components/LayoutObjectCreateForm";
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

  return (
    <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
        <Button
          startIcon={<ArrowBackOutlined />}
          variant="text"
          size="small"
          onClick={() => navigate(officeDetailPath(officeId))}
          sx={{ mb: 1 }}
        >
          {c.backToFloors}
        </Button>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 3 }}>
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

      {error ? (
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
      ) : loading ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LoadingState />
        </Box>
      ) : (
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 }, flex: 1 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
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
            <Grid size={{ xs: 12, md: 8 }}>
              {objects.length === 0 ? (
                <LayoutObjectEmptyState onAdd={handleCreate} />
              ) : (
                <LayoutObjectList
                  officeId={officeId}
                  floorId={floorId}
                  objects={objects}
                  onDeleted={refresh}
                />
              )}
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}
