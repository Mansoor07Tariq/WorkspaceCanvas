import { useState } from "react";
import { Box } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
  hasActiveMembership,
  canManageOfficeSetup,
} from "@/features/organizations/utils/membershipUtils";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { OrganizationSetupFlow } from "@/features/organizations/components/OrganizationSetupFlow";
import { LoadingState } from "@/components/feedback/LoadingState";
import { OfficesEmptyState } from "@/features/offices/components/OfficesEmptyState";
import { OfficeCreationFlow } from "@/features/offices/components/OfficeCreationFlow";
import { OfficesList } from "@/features/offices/components/OfficesList";
import { useOffices } from "@/features/offices/hooks/useOffices";

type PageMode = "list" | "create";

export function AppOfficesPage() {
  const { user } = useAuth();
  const { selectedMembership, selectedOrganizationId } = useSelectedOrganization();
  const [orgJustCreated, setOrgJustCreated] = useState(false);
  const [mode, setMode] = useState<PageMode>("list");

  const hasOrg = orgJustCreated || hasActiveMembership(user);
  const canManage = canManageOfficeSetup(selectedMembership?.role);

  const { offices, loading, refresh } = useOffices(selectedOrganizationId);

  if (!hasOrg) {
    return (
      <OrganizationSetupFlow
        onCreated={() => {
          setOrgJustCreated(true);
        }}
      />
    );
  }

  if (canManage && mode === "create") {
    return (
      <OfficeCreationFlow
        orgId={selectedOrganizationId}
        onCreated={() => {
          refresh();
          setMode("list");
        }}
      />
    );
  }

  if (loading) {
    return (
      <Box
        sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100%" }}
      >
        <LoadingState />
      </Box>
    );
  }

  if (offices.length === 0) {
    return <OfficesEmptyState canManage={canManage} onAddOffice={() => setMode("create")} />;
  }

  return (
    <OfficesList offices={offices} canManage={canManage} onAddOffice={() => setMode("create")} />
  );
}
