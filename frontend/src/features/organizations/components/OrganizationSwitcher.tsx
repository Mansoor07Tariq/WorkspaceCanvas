import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useSelectedOrganization } from "../context/SelectedOrganizationProvider";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";

/**
 * Compact workspace (organization) switcher for users with more than one active
 * membership. Renders nothing for single-org or no-org users.
 *
 * On switch it updates the selected-org context (which re-scopes org-scoped
 * hooks via their org-namespaced cache keys) and navigates to the dashboard, so
 * the user is never left on a stale office/floor route belonging to the old org.
 */
export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const {
    activeMemberships,
    selectedOrganizationId,
    setSelectedOrganizationId,
    hasMultipleOrganizations,
  } = useSelectedOrganization();

  if (!hasMultipleOrganizations) return null;

  function handleChange(e: SelectChangeEvent<number>) {
    const id = Number(e.target.value);
    setSelectedOrganizationId(id);
    // Avoid leaving the user on an office/floor route from the previous org.
    navigate(ROUTES.app);
  }

  return (
    <FormControl size="small" sx={{ minWidth: 180, mr: 2 }}>
      <InputLabel id="workspace-switcher-label">{en.app.shell.workspaceSwitcherLabel}</InputLabel>
      <Select
        labelId="workspace-switcher-label"
        label={en.app.shell.workspaceSwitcherLabel}
        value={selectedOrganizationId ?? ""}
        onChange={handleChange}
        data-testid="organization-switcher"
      >
        {activeMemberships.map((m) => (
          <MenuItem key={m.organization_id} value={m.organization_id}>
            {m.organization_name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
