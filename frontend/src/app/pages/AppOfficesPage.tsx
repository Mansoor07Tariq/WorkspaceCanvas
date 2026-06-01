import { useState } from "react";
import { Box } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
  hasActiveMembership,
  canManageOfficeSetup,
  getFirstActiveMembership,
} from "@/features/organizations/utils/membershipUtils";
import { OrganizationSetupFlow } from "@/features/organizations/components/OrganizationSetupFlow";
import { LoadingState } from "@/components/feedback/LoadingState";
import { OfficesEmptyState } from "@/features/offices/components/OfficesEmptyState";
import { OfficeCreationFlow } from "@/features/offices/components/OfficeCreationFlow";
import { OfficesList } from "@/features/offices/components/OfficesList";
import { useOffices } from "@/features/offices/hooks/useOffices";

type PageMode = "list" | "create";

export function AppOfficesPage() {
  const { user } = useAuth();
  const [orgJustCreated, setOrgJustCreated] = useState(false);
  const [mode, setMode] = useState<PageMode>("list");

  const hasOrg = orgJustCreated || hasActiveMembership(user);
  const membership = getFirstActiveMembership(user);
  const canManage = canManageOfficeSetup(membership?.role);

  const { offices, loading, refresh } = useOffices();

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
