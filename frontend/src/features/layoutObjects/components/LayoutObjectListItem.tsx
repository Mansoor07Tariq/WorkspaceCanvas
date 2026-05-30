import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { DeleteOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import { DeskBadge } from "@/features/desks/components/DeskBadge";
import type { LayoutObject } from "../types/layoutObject.types";

const c = en.app.layoutObjects;

interface Props {
  obj: LayoutObject;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
  onDelete: (id: number) => void;
  deleteDisabled?: boolean;
  canDelete?: boolean;
  hasDesk?: boolean;
}

export function LayoutObjectListItem({
  obj,
  isSelected = false,
  onSelect,
  onDelete,
  deleteDisabled,
  canDelete = true,
  hasDesk = false,
}: Props) {
  return (
    <Box
      onClick={() => onSelect?.(obj.id)}
      sx={{
        border: "1px solid",
        borderColor: isSelected ? "primary.main" : "divider",
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: isSelected ? "primary.50" : "background.paper",
        cursor: onSelect ? "pointer" : "default",
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": onSelect ? { borderColor: "primary.light" } : {},
      }}
    >
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {obj.object_type_display}
              {obj.label ? ` — ${obj.label}` : ""}
            </Typography>
            {hasDesk && <DeskBadge />}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div">
            {c.positionColumn}: ({obj.x}, {obj.y}) &nbsp;·&nbsp; {c.sizeColumn}: {obj.width} ×{" "}
            {obj.height} &nbsp;·&nbsp; {c.rotationColumn}: {obj.rotation}°
          </Typography>
        </Box>
        {canDelete && (
          <Tooltip title={c.deleteButton}>
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(obj.id);
                }}
                disabled={deleteDisabled}
                aria-label={c.deleteButton}
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}
