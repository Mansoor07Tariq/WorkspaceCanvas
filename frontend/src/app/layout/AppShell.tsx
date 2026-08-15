import { useState } from "react";
import type { ReactNode } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { MapOutlined, MenuOutlined } from "@mui/icons-material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher";
import { initialsFromName } from "@/theme/tokens";
import { AppSidebar, SIDEBAR_WIDTH } from "./AppSidebar";
import { BottomTabBar } from "./BottomTabBar";
import { SidebarCollapseContext } from "./SidebarCollapseContext";
import * as s from "./AppShell.styles";
import { en } from "@/i18n/en";

interface Props {
  children: ReactNode;
  onLogout: () => void;
}

export function AppShell({ children, onLogout }: Props) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A page (e.g. the floor-map canvas) can collapse the side nav into a burger +
  // temporary drawer at ALL breakpoints to free horizontal space.
  const [collapsed, setCollapsed] = useState(false);

  const displayName = user?.first_name || user?.full_name || user?.email || "";

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AppBar position="sticky" elevation={0} color="default" sx={s.appBar}>
          <Toolbar variant="dense">
            <IconButton
              edge="start"
              color="inherit"
              aria-label={en.app.shell.openNav}
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1, display: collapsed ? "inline-flex" : "none" }}
            >
              <MenuOutlined />
            </IconButton>
            {/* Brand shown when there's no side rail (phone), or when collapsed */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                flexGrow: 1,
                display: { xs: "flex", sm: collapsed ? "flex" : "none" },
              }}
            >
              <Box aria-hidden sx={s.brandTileSm}>
                <MapOutlined fontSize="small" />
              </Box>
              <Typography sx={s.brandText}>{en.app.shell.brand}</Typography>
            </Stack>
            <Box sx={{ flexGrow: 1, display: { xs: "none", sm: collapsed ? "none" : "block" } }} />
            <OrganizationSwitcher />
            {user && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", ml: 1.5, mr: 1.5 }}>
                <Avatar sx={s.userAvatar(user.email ?? displayName)}>
                  {initialsFromName(displayName)}
                </Avatar>
                <Typography variant="body2" color="text.secondary" sx={s.userName}>
                  {displayName}
                </Typography>
              </Stack>
            )}
            <Button variant="outlined" color="inherit" size="small" onClick={onLogout}>
              {en.app.shell.logout}
            </Button>
          </Toolbar>
        </AppBar>

        {/* Temporary drawer — for the burger (collapsed canvas pages) */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          variant="temporary"
          sx={{ "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" } }}
        >
          <AppSidebar onNavigate={() => setDrawerOpen(false)} />
        </Drawer>

        <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
          {/* Tablet icon rail (sm–md), hidden when collapsed */}
          <Box sx={{ display: collapsed ? "none" : { xs: "none", sm: "flex", md: "none" } }}>
            <AppSidebar variant="rail" />
          </Box>
          {/* Desktop full sidebar (md+), hidden when collapsed */}
          <Box sx={{ display: collapsed ? "none" : { xs: "none", md: "flex" } }}>
            <AppSidebar variant="full" />
          </Box>
          <Box
            component="main"
            sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
          >
            {children}
          </Box>
        </Box>

        {/* Phone bottom tab bar */}
        <BottomTabBar />
      </Box>
    </SidebarCollapseContext.Provider>
  );
}
