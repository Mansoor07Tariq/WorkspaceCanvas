import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { AutoAwesomeOutlined, MapOutlined } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { en } from "@/i18n/en";
import { NAV_ITEMS, isNavItemActive } from "./navItems";
import * as s from "./AppSidebar.styles";
import { RAIL_WIDTH, SIDEBAR_WIDTH } from "./sidebarDimensions";

export { SIDEBAR_WIDTH, RAIL_WIDTH };

interface Props {
  onNavigate?: () => void;
  /** "full" = labelled desktop rail; "rail" = icon-only tablet rail (labels as tooltips) */
  variant?: "full" | "rail";
}

export function AppSidebar({ onNavigate, variant = "full" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profileComplete = user?.is_profile_completed ?? false;
  const isRail = variant === "rail";

  return (
    <Box component="nav" aria-label={en.app.sidebar.primaryNavLabel} sx={s.navRoot(isRail)}>
      {/* Brand mark (matches the prototype's logo tile) */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          px: isRail ? 0 : 2,
          justifyContent: isRail ? "center" : "flex-start",
          mb: 2,
        }}
      >
        <Box aria-hidden sx={s.brandTile}>
          <MapOutlined fontSize="small" />
        </Box>
        {!isRail && <Typography sx={s.brandText}>{en.app.shell.brand}</Typography>}
      </Stack>

      <List dense disablePadding sx={{ px: isRail ? 0.5 : 1 }}>
        {NAV_ITEMS.map((item) => {
          const { id, label, Icon, path, alwaysEnabled } = item;
          const disabled = !alwaysEnabled && !profileComplete;
          const selected = isNavItemActive(item, location.pathname);

          const button = (
            <ListItemButton
              disabled={disabled}
              selected={selected}
              onClick={() => {
                navigate(path);
                onNavigate?.();
              }}
              aria-label={label}
              aria-current={selected ? "page" : undefined}
              sx={s.navButton(isRail)}
            >
              <ListItemIcon sx={s.navIcon(isRail, selected)}>
                <Icon fontSize="small" />
              </ListItemIcon>
              {isRail ? (
                <Typography sx={s.railLabel(selected)}>{label}</Typography>
              ) : (
                <ListItemText primary={label} slotProps={{ primary: s.navLabelSlot(selected) }} />
              )}
            </ListItemButton>
          );

          return (
            <ListItem key={id} disablePadding sx={{ mb: 0.25 }}>
              {disabled ? (
                <Tooltip title={en.app.sidebar.lockedTooltip} placement="right">
                  <span style={{ width: "100%" }}>{button}</span>
                </Tooltip>
              ) : isRail ? (
                <Tooltip title={label} placement="right">
                  <span style={{ width: "100%" }}>{button}</span>
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        })}
      </List>

      {/* "Almost there" card — full rail only, when profile is incomplete */}
      {!isRail && user != null && !profileComplete && (
        <Box sx={{ px: 1.5, pt: 2, pb: 2, mt: "auto" }}>
          <Box sx={s.almostThereBox}>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <AutoAwesomeOutlined sx={s.almostThereIcon} />
                <Typography variant="caption" sx={s.almostThereTitle}>
                  {en.app.sidebar.almostThereTitle}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={s.almostThereBody}>
                {en.app.sidebar.almostThereBody}
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
