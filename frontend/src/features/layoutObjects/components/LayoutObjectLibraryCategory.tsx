import { Box, Chip, Typography } from "@mui/material";
import type {
  LayoutObjectCategory,
  LayoutObjectDefinition,
  LayoutObjectType,
} from "../types/layoutObject.types";
import { CATEGORY_LABELS } from "../utils/layoutObjectLibrary";

interface Props {
  category: LayoutObjectCategory;
  objects: LayoutObjectDefinition[];
  selectedType: LayoutObjectType | "";
  onSelect: (type: LayoutObjectType) => void;
}

export function LayoutObjectLibraryCategory({ category, objects, selectedType, onSelect }: Props) {
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {objects.map((def) => (
          <Chip
            key={def.type}
            label={def.label}
            size="small"
            variant={selectedType === def.type ? "filled" : "outlined"}
            color={selectedType === def.type ? "primary" : "default"}
            onClick={() => onSelect(def.type)}
            sx={{ cursor: "pointer", fontSize: "0.72rem" }}
          />
        ))}
      </Box>
    </Box>
  );
}
