import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { DeleteOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { LayoutObject } from "../types/layoutObject.types";

const c = en.app.layoutObjects;

interface Props {
  obj: LayoutObject;
  onDelete: (id: number) => void;
  deleteDisabled?: boolean;
}

export function LayoutObjectListItem({ obj, onDelete, deleteDisabled }: Props) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {obj.object_type_display}
            {obj.label ? ` — ${obj.label}` : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {c.positionColumn}: ({obj.x}, {obj.y}) &nbsp;·&nbsp; {c.sizeColumn}: {obj.width} ×{" "}
            {obj.height} &nbsp;·&nbsp; {c.rotationColumn}: {obj.rotation}°
            {obj.is_bookable && <> &nbsp;·&nbsp; {c.bookableColumn}</>}
          </Typography>
        </Box>
        <Tooltip title={c.deleteButton}>
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(obj.id)}
              disabled={deleteDisabled}
              aria-label={c.deleteButton}
            >
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
