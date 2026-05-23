import { Box, Typography } from "@mui/material";
import { en } from "@/i18n/en";

export function AppPlaceholderPage() {
  return (
    <Box sx={{ p: 4, textAlign: "center" }}>
      <Typography variant="h5">{en.auth.login.signedInTitle}</Typography>
      <Typography variant="body1" sx={{ mt: 2, color: "text.secondary" }}>
        {en.auth.login.signedInMessage}
      </Typography>
    </Box>
  );
}
