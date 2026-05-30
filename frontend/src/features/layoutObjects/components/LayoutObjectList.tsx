import { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { deleteLayoutObject } from "../api/layoutObjectApi";
import type { LayoutObject } from "../types/layoutObject.types";
import { LayoutObjectListItem } from "./LayoutObjectListItem";

const c = en.app.layoutObjects;

interface Props {
  officeId: number;
  floorId: number;
  objects: LayoutObject[];
  onDeleted: () => void;
}

export function LayoutObjectList({ officeId, floorId, objects, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteLayoutObject(officeId, floorId, id);
      onDeleted();
    } finally {
      setDeletingId(null);
    }
  }

  if (objects.length === 0) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        {c.listTitle}
      </Typography>
      <Stack spacing={1}>
        {objects.map((obj) => (
          <LayoutObjectListItem
            key={obj.id}
            obj={obj}
            onDelete={handleDelete}
            deleteDisabled={deletingId === obj.id}
          />
        ))}
      </Stack>
    </Box>
  );
}
