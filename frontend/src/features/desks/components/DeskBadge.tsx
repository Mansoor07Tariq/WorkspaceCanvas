import { Chip } from "@mui/material";
import { en } from "@/i18n/en";

const c = en.app.desks;

export function DeskBadge() {
  return (
    <Chip
      label={c.bookableBadge}
      size="small"
      color="success"
      variant="filled"
      sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
    />
  );
}
