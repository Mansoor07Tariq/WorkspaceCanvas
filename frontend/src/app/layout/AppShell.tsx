import { useState } from "react";
import type { ReactNode } from "react";
import { AppBar, Box, Button, Drawer, IconButton, Toolbar, Typography } from "@mui/material";
import { MenuOutlined } from "@mui/icons-material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher";
import { AppSidebar, SIDEBAR_WIDTH } from "./AppSidebar";
import { en } from "@/i18n/en";

interface Props {
  children: ReactNode;
  onLogout: () => void;
}

export function AppShell({ children, onLogout }: Props) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" elevation={1} color="default" sx={{ bgcolor: "background.paper" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label={en.app.shell.openNav}
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 1, display: { md: "none" } }}
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

      {/* Mobile drawer — visible only below md breakpoint */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant="temporary"
        sx={{
          display: { md: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
        }}
      >
        <AppSidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Box sx={{ display: "flex", flexGrow: 1 }}>
        {/* Permanent sidebar — hidden on mobile */}
        <Box sx={{ display: { xs: "none", md: "flex" } }}>
          <AppSidebar />
        </Box>
        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
