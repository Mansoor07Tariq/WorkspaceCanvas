import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";

const STORAGE_KEY = "wc.selectedOrganizationId";

export interface SelectedOrganizationValue {
  /** The user's active memberships (has_active_access === true). */
  activeMemberships: MembershipInline[];
  /** Currently selected organization id, or null when the user has no active org. */
  selectedOrganizationId: number | null;
  /** Membership for the selected org (role + ids), or null. */
  selectedMembership: MembershipInline | null;
  selectedOrganizationName: string | null;
  /** Switch the active organization. Ignored if the id is not an active membership. */
  setSelectedOrganizationId: (id: number) => void;
  /** True when more than one active membership exists (switcher is shown). */
  hasMultipleOrganizations: boolean;
}

const SelectedOrganizationContext = createContext<SelectedOrganizationValue | null>(null);

function getActiveMemberships(user: CurrentUser | null): MembershipInline[] {
  return (user?.memberships ?? []).filter((m) => m.has_active_access);
}

/**
 * Default value derived purely from the current user — used both as the
 * provider's seed and as the fallback when `useSelectedOrganization` is called
 * outside the provider (e.g. a page rendered in isolation in unit tests). In
 * the fallback case the selection equals the first active membership and
 * switching is a no-op, exactly matching pre-PR-055 single-org behaviour.
 */
function deriveDefault(user: CurrentUser | null): SelectedOrganizationValue {
  const activeMemberships = getActiveMemberships(user);
  const first = activeMemberships[0] ?? null;
  return {
    activeMemberships,
    selectedOrganizationId: first?.organization_id ?? null,
    selectedMembership: first,
    selectedOrganizationName: first?.organization_name ?? null,
    setSelectedOrganizationId: () => {},
    hasMultipleOrganizations: activeMemberships.length > 1,
  };
}

function readStoredOrgId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function writeStoredOrgId(id: number | null): void {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Ignore storage failures (private mode / disabled storage).
  }
}

export function SelectedOrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const activeMemberships = useMemo(() => getActiveMemberships(user), [user]);

  // The user's last explicit choice (may be stale if a membership was removed).
  const [rawSelectedId, setRawSelectedId] = useState<number | null>(() => readStoredOrgId());

  // Derive the EFFECTIVE selection during render: the raw choice if it is still
  // an active membership, otherwise the first active membership (or null). This
  // re-validates automatically when the membership set changes — no effect, no
  // stale selection bug.
  const selectedOrganizationId =
    rawSelectedId !== null && activeMemberships.some((m) => m.organization_id === rawSelectedId)
      ? rawSelectedId
      : (activeMemberships[0]?.organization_id ?? null);

  // Keep localStorage in sync with the resolved selection.
  useEffect(() => {
    writeStoredOrgId(selectedOrganizationId);
  }, [selectedOrganizationId]);

  const setSelectedOrganizationId = useCallback(
    (id: number) => {
      if (activeMemberships.some((m) => m.organization_id === id)) {
        setRawSelectedId(id);
      }
    },
    [activeMemberships]
  );

  const value = useMemo<SelectedOrganizationValue>(() => {
    const selectedMembership =
      activeMemberships.find((m) => m.organization_id === selectedOrganizationId) ?? null;
    return {
      activeMemberships,
      selectedOrganizationId,
      selectedMembership,
      selectedOrganizationName: selectedMembership?.organization_name ?? null,
      setSelectedOrganizationId,
      hasMultipleOrganizations: activeMemberships.length > 1,
    };
  }, [activeMemberships, selectedOrganizationId, setSelectedOrganizationId]);

  return (
    <SelectedOrganizationContext.Provider value={value}>
      {children}
    </SelectedOrganizationContext.Provider>
  );
}

/**
 * Access the selected organization. Works without a provider by falling back to
 * the first active membership (single-org behaviour), so pages can be rendered
 * in isolation in tests.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedOrganization(): SelectedOrganizationValue {
  const ctx = useContext(SelectedOrganizationContext);
  const { user } = useAuth();
  const fallback = useMemo(() => deriveDefault(user), [user]);
  return ctx ?? fallback;
}
