import { Box, Button, Stack, Typography } from "@mui/material";
import { BusinessOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";

interface Props {
  onStart: () => void;
}

const c = en.app.orgSetup;

export function OrgStepWelcome({ onStart }: Props) {
  return (
    <Stack spacing={4} sx={{ alignItems: "center", textAlign: "center", py: 2 }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BusinessOutlined sx={{ fontSize: 36, color: "primary.contrastText" }} />
      </Box>
      <Stack spacing={1.5}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {c.stepWelcomeTitle}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
          {c.stepWelcomeSubtitle}
        </Typography>
      </Stack>
      <Button variant="contained" size="large" onClick={onStart} sx={{ px: 5, mt: 1 }}>
        {c.stepWelcomeCta}
      </Button>
    </Stack>
  );
}
