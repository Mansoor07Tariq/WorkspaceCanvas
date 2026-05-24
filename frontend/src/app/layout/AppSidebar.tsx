import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import {
  BusinessOutlined,
  CalendarMonthOutlined,
  GridViewOutlined,
  PeopleOutlined,
  WeekendOutlined,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import type { SvgIconComponent } from "@mui/icons-material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

interface NavItem {
  label: string;
  Icon: SvgIconComponent;
  path: string;
  alwaysEnabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: en.app.sidebar.dashboard,
    Icon: GridViewOutlined,
    path: ROUTES.app,
    alwaysEnabled: true,
  },
  { label: en.app.sidebar.offices, Icon: BusinessOutlined, path: ROUTES.offices },
  { label: en.app.sidebar.deskBooking, Icon: WeekendOutlined, path: ROUTES.bookings },
  { label: en.app.sidebar.events, Icon: CalendarMonthOutlined, path: ROUTES.events },
  { label: en.app.sidebar.people, Icon: PeopleOutlined, path: ROUTES.people },
];

const SIDEBAR_WIDTH = 220;

export function AppSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profileComplete = user?.is_profile_completed ?? false;

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        pt: 1,
      }}
    >
      <List dense disablePadding>
        {NAV_ITEMS.map(({ label, Icon, path, alwaysEnabled }) => {
          const disabled = !alwaysEnabled && !profileComplete;
          const selected = location.pathname === path;

          const button = (
            <ListItemButton
              disabled={disabled}
              selected={selected}
              onClick={() => navigate(path)}
              aria-label={label}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={label} slotProps={{ primary: { variant: "body2" } }} />
            </ListItemButton>
          );

          return (
            <ListItem key={path} disablePadding>
              {disabled ? (
                <Tooltip title={en.app.sidebar.lockedTooltip} placement="right">
                  <span style={{ width: "100%" }}>{button}</span>
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
