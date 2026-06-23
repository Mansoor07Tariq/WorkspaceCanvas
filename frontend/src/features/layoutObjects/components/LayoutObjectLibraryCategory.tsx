import { Box, ButtonBase, Typography } from "@mui/material";
import type {
  LayoutObjectCategory,
  LayoutObjectDefinition,
  LayoutObjectType,
} from "../types/layoutObject.types";
import { CATEGORY_LABELS } from "../utils/layoutObjectLibrary";
import { getLayoutObjectIcon } from "./layoutObjectIcons";

interface Props {
  category: LayoutObjectCategory;
  objects: LayoutObjectDefinition[];
  selectedType: LayoutObjectType | "";
  onSelect: (type: LayoutObjectType) => void;
}

/**
 * One library category rendered as a 2-per-row grid of icon + label tiles
 * (PR 065) — Paint-style picker tiles, easier to scan than chips.
 */
export function LayoutObjectLibraryCategory({ category, objects, selectedType, onSelect }: Props) {
  if (objects.length === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          display: "block",
          mb: 0.75,
        }}
      >
        {CATEGORY_LABELS[category]}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1 }}>
        {objects.map((def) => {
          const Icon = getLayoutObjectIcon(def.type);
          const selected = selectedType === def.type;
          return (
            <ButtonBase
              key={def.type}
              data-testid={`library-tile-${def.type}`}
              aria-pressed={selected}
              onClick={() => onSelect(def.type)}
              sx={{
                flexDirection: "column",
                justifyContent: "center",
                gap: 0.5,
                px: 1,
                py: 1.25,
                width: "100%",
                minHeight: 72,
                borderRadius: 1.5,
                border: 1,
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: selected ? "action.selected" : "background.paper",
                color: selected ? "primary.main" : "text.primary",
                transition: "border-color 120ms, background-color 120ms",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              <Icon fontSize="small" color={selected ? "primary" : "action"} />
              <Typography
                variant="caption"
                sx={{ lineHeight: 1.15, textAlign: "center", fontWeight: selected ? 600 : 400 }}
              >
                {def.label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
