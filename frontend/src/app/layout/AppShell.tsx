import type { ReactNode } from "react";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { en } from "@/i18n/en";

interface Props {
  children: ReactNode;
  onLogout: () => void;
}

export function AppShell({ children, onLogout }: Props) {
  const { user } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" elevation={1} color="default" sx={{ bgcolor: "background.paper" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {en.app.shell.brand}
          </Typography>
          {user && (
            <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
              {user.email}
            </Typography>
          )}
          <Button variant="outlined" color="inherit" size="small" onClick={onLogout}>
            {en.app.shell.logout}
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: "flex", flexGrow: 1 }}>
        <AppSidebar />
        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
