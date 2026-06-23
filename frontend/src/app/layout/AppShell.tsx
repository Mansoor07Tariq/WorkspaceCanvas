import { useState } from "react";
import type { ReactNode } from "react";
import { AppBar, Box, Button, Drawer, IconButton, Toolbar, Typography } from "@mui/material";
import { MenuOutlined } from "@mui/icons-material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher";
import { AppSidebar, SIDEBAR_WIDTH } from "./AppSidebar";
import { SidebarCollapseContext } from "./SidebarCollapseContext";
import { en } from "@/i18n/en";

interface Props {
  children: ReactNode;
  onLogout: () => void;
}

export function AppShell({ children, onLogout }: Props) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A page (e.g. the floor-map canvas) can collapse the permanent rail into a
  // burger + temporary drawer at ALL breakpoints to free horizontal space.
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AppBar
          position="static"
          elevation={1}
          color="default"
          sx={{ bgcolor: "background.paper" }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label={en.app.shell.openNav}
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1, display: collapsed ? "inline-flex" : { md: "none" } }}
            >
              <MenuOutlined />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
              {en.app.shell.brand}
            </Typography>
            <OrganizationSwitcher />
            {user && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mr: 2, display: { xs: "none", sm: "block" } }}
              >
                {user.email}
              </Typography>
            )}
            <Button variant="outlined" color="inherit" size="small" onClick={onLogout}>
              {en.app.shell.logout}
            </Button>
          </Toolbar>
        </AppBar>

        {/* Temporary drawer — below md, or at all widths when a page collapses the rail */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          variant="temporary"
          sx={{
            display: collapsed ? "block" : { md: "none" },
            "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
          }}
        >
          <AppSidebar onNavigate={() => setDrawerOpen(false)} />
        </Drawer>

        <Box sx={{ display: "flex", flexGrow: 1 }}>
          {/* Permanent sidebar — hidden on mobile, and when a page collapses the rail */}
          <Box sx={{ display: collapsed ? "none" : { xs: "none", md: "flex" } }}>
            <AppSidebar />
          </Box>
          <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </SidebarCollapseContext.Provider>
  );
}
