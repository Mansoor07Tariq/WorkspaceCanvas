import { Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/paths";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      component="main"
      role="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center", maxWidth: 400 }}>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: "4rem", sm: "6rem" }, fontWeight: 700, color: "text.disabled" }}
        >
          404
        </Typography>
        <Stack spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Page Not Found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The page you&apos;re looking for doesn&apos;t exist.
          </Typography>
        </Stack>
        <Button variant="contained" onClick={() => navigate(ROUTES.app)}>
          Back to App
        </Button>
      </Stack>
    </Box>
  );
}
