import { Alert, Box, Typography } from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";

const c = en.app.dashboard;

export function MemberWorkspaceStatus() {
  return (
    <Alert role="status" severity="info" icon={<InfoOutlined fontSize="inherit" />} sx={{ mb: 3 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {c.memberSetupTitle}
        </Typography>
        <Typography variant="body2">{c.memberSetupDesc}</Typography>
      </Box>
    </Alert>
  );
}
