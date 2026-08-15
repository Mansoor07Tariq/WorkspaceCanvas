import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import * as s from "./AdminSetupBanner.styles";

const DISMISS_KEY = "wc.today.adminSetupDismissed.v1";

/** Per-org dismissal set (ids only), persisted in localStorage — defensive parse. */
function loadDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "number")) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<number>): void {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — banner simply reappears next load */
  }
}

interface Props {
  orgId: number;
}

/**
 * Admin-only "finish setup" banner (PR 079), shown when an admin's org has incomplete
 * setup. Dismissal is remembered per org in localStorage (ids only). Callers render this
 * only for admins of incomplete-setup orgs.
 */
export function AdminSetupBanner({ orgId }: Props) {
  const [dismissed, setDismissed] = useState(() => loadDismissed().has(orgId));
  if (dismissed) return null;

  const dismiss = () => {
    const next = loadDismissed();
    next.add(orgId);
    persistDismissed(next);
    setDismissed(true);
  };

  return (
    <Alert
      severity="info"
      icon={false}
      sx={s.alert}
      action={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button component={Link} to={ROUTES.offices} size="small" variant="contained">
            {en.app.today.adminBannerCta}
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={dismiss}
            aria-label={en.app.today.adminBannerDismiss}
          >
            {en.app.today.adminBannerDismiss}
          </Button>
        </Stack>
      }
    >
      <Typography sx={s.title}>{en.app.today.adminBannerTitle}</Typography>
      <Typography variant="body2">{en.app.today.adminBannerBody}</Typography>
    </Alert>
  );
}
