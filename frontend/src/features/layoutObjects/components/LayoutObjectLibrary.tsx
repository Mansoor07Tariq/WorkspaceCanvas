import { Paper, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import type { LayoutObjectType } from "../types/layoutObject.types";
import {
  LAYOUT_OBJECT_CATEGORIES,
  getPaletteObjectsByCategory,
} from "../utils/layoutObjectLibrary";
import { LayoutObjectLibraryCategory } from "./LayoutObjectLibraryCategory";

const c = en.app.layoutObjects;
const objectsByCategory = getPaletteObjectsByCategory();

interface Props {
  selectedType: LayoutObjectType | "";
  onSelect: (type: LayoutObjectType) => void;
}

export function LayoutObjectLibrary({ selectedType, onSelect }: Props) {
  return (
    <Paper variant="outlined" data-testid="object-library" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
        {c.libraryTitle}
      </Typography>
      {LAYOUT_OBJECT_CATEGORIES.map((category) => {
        const objects = objectsByCategory.get(category) ?? [];
        return (
          <LayoutObjectLibraryCategory
            key={category}
            category={category}
            objects={objects}
            selectedType={selectedType}
            onSelect={onSelect}
          />
        );
      })}
    </Paper>
  );
}
