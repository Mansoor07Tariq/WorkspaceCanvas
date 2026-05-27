import { Box, Button, Stack, Typography } from "@mui/material";
import { BusinessOutlined } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { en } from "@/i18n/en";

const c = en.app.offices;

interface Props {
  onAddOffice: () => void;
}

export function OfficesEmptyState({ onAddOffice }: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center", maxWidth: 420 }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BusinessOutlined sx={{ fontSize: 40, color: "primary.main" }} aria-hidden="true" />
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {c.emptyStateTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {c.emptyStateSubtitle}
          </Typography>
        </Stack>
        <Button variant="contained" onClick={onAddOffice}>
          {c.emptyStateAction}
        </Button>
      </Stack>
    </Box>
  );
}
