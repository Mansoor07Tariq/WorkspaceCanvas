import { Box, Button, Typography } from "@mui/material";
import { GridViewOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";

const c = en.app.layoutObjects;

interface Props {
  onAdd: () => void;
}

export function LayoutObjectEmptyState({ onAdd }: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        px: 3,
        textAlign: "center",
      }}
    >
      <GridViewOutlined sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {c.emptyStateTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 440 }}>
        {c.emptyStateSubtitle}
      </Typography>
      <Button variant="contained" onClick={onAdd}>
        {c.addButton}
      </Button>
    </Box>
  );
}
