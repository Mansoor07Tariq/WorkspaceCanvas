import { useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { hasActiveMembership } from "@/features/organizations/utils/membershipUtils";
import { OrganizationSetupFlow } from "@/features/organizations/components/OrganizationSetupFlow";
import { OfficesEmptyState } from "@/features/organizations/components/OfficesEmptyState";

export function AppOfficesPage() {
  const { user } = useAuth();
  const [orgJustCreated, setOrgJustCreated] = useState(false);

  const hasOrg = orgJustCreated || hasActiveMembership(user);

  if (!hasOrg) {
    return <OrganizationSetupFlow onCreated={() => setOrgJustCreated(true)} />;
  }

  return <OfficesEmptyState />;
}
