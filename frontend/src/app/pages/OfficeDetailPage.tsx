import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Box, Button } from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import {
  canManageOfficeSetup,
  getMembershipForOrganization,
} from "@/features/organizations/utils/membershipUtils";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useFloors } from "@/features/floors/hooks/useFloors";
import { FloorsEmptyState } from "@/features/floors/components/FloorsEmptyState";
import { FloorCreationFlow } from "@/features/floors/components/FloorCreationFlow";
import { FloorsList } from "@/features/floors/components/FloorsList";

const c = en.app.floors;

type PageMode = "list" | "create";

export function OfficeDetailPage() {
  const { officeId: officeIdParam } = useParams<{ officeId: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<PageMode>("list");

  const { activeMemberships, selectedMembership } = useSelectedOrganization();

  const officeId = parseInt(officeIdParam ?? "", 10);
  const { floors, loading, error, refresh } = useFloors(isNaN(officeId) ? 0 : officeId);

  // TD-045: gate on the membership for THIS office's organization (resolved from
  // the loaded floors), so a multi-org user whose role differs across orgs sees
  // the correct affordance even when this office is not their selected org. Fall
  // back to the selected membership before the floors load / when the office has
  // no floors yet. Backend enforces the real permission regardless.
  const officeOrganizationId = floors[0]?.organization ?? null;
  const membership =
    getMembershipForOrganization(activeMemberships, officeOrganizationId) ?? selectedMembership;
  const canManage = canManageOfficeSetup(membership?.role);

  if (isNaN(officeId)) {
    return <Navigate to={ROUTES.offices} replace />;
  }

  if (canManage && mode === "create") {
    return (
      <FloorCreationFlow
        officeId={officeId}
        onCreated={() => {
          refresh();
          setMode("list");
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
        <Button
          startIcon={<ArrowBackOutlined />}
          variant="text"
          size="small"
          onClick={() => navigate(ROUTES.offices)}
          sx={{ mb: 1 }}
        >
          {c.backToOffices}
        </Button>
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
            <Button variant="text" onClick={() => navigate(ROUTES.offices)} sx={{ mt: 2 }}>
              {c.backToOffices}
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
      ) : floors.length === 0 ? (
        <FloorsEmptyState canManage={canManage} onAddFloor={() => setMode("create")} />
      ) : (
        <FloorsList
          floors={floors}
          officeId={officeId}
          canManage={canManage}
          onAddFloor={() => setMode("create")}
        />
      )}
    </Box>
  );
}
