import { Box, Button, Grid, Typography } from "@mui/material";
import {
  BookmarkAddOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  EditOutlined,
  PeopleOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { Office } from "@/features/offices/types/office.types";
import type { Floor } from "@/features/floors/types/floor.types";
import { ROUTES, floorLayoutPath } from "@/routes/paths";
import { en } from "@/i18n/en";

interface QuickAction {
  label: string;
  to: string;
  icon: ReactNode;
  variant: "contained" | "outlined";
}

interface Props {
  isOwnerOrAdmin: boolean;
  firstOffice: Office | null;
  firstFloor: Floor | null;
}

export function DashboardQuickActions({ isOwnerOrAdmin, firstOffice, firstFloor }: Props) {
  const floorMapTo =
    firstOffice && firstFloor ? floorLayoutPath(firstOffice.id, firstFloor.id) : ROUTES.offices;

  const adminActions: QuickAction[] = [
    {
      label: en.app.dashboard.actionBookDesk,
      to: ROUTES.bookings,
      icon: <BookmarkAddOutlined />,
      variant: "contained",
    },
    {
      label: en.app.dashboard.actionMyBookings,
      to: ROUTES.myBookings,
      icon: <CalendarMonthOutlined />,
      variant: "outlined",
    },
    {
      label: en.app.dashboard.actionManageOffices,
      to: ROUTES.offices,
      icon: <BusinessOutlined />,
      variant: "outlined",
    },
    {
      label: en.app.dashboard.actionBuildFloorMap,
      to: floorMapTo,
      icon: <EditOutlined />,
      variant: "outlined",
    },
    {
      label: en.app.dashboard.actionInvitePeople,
      to: ROUTES.people,
      icon: <PeopleOutlined />,
      variant: "outlined",
    },
  ];

  const memberActions: QuickAction[] = [
    {
      label: en.app.dashboard.actionBookDesk,
      to: ROUTES.bookings,
      icon: <BookmarkAddOutlined />,
      variant: "contained",
    },
    {
      label: en.app.dashboard.actionMyBookings,
      to: ROUTES.myBookings,
      icon: <CalendarMonthOutlined />,
      variant: "outlined",
    },
  ];

  const actions = isOwnerOrAdmin ? adminActions : memberActions;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
        {en.app.dashboard.quickActionsTitle}
      </Typography>
      <Grid container spacing={1.5}>
        {actions.map((action) => (
          <Grid key={action.label} size={{ xs: 12, sm: "auto" }}>
            <Button
              component={Link}
              to={action.to}
              variant={action.variant}
              startIcon={action.icon}
              sx={{
                width: { xs: "100%", sm: "auto" },
                justifyContent: { xs: "flex-start", sm: "center" },
              }}
            >
              {action.label}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
