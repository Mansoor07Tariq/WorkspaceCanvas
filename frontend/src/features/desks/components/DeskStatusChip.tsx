import { Chip } from "@mui/material";
import { en } from "@/i18n/en";
import type { DeskStatus } from "../types/desk.types";

const c = en.app.desks;

const STATUS_COLOR: Record<DeskStatus, "success" | "warning" | "error"> = {
  available: "success",
  unavailable: "warning",
  maintenance: "error",
};

const STATUS_LABEL: Record<DeskStatus, string> = {
  available: c.statusAvailable,
  unavailable: c.statusUnavailable,
  maintenance: c.statusMaintenance,
};

interface Props {
  status: DeskStatus;
}

export function DeskStatusChip({ status }: Props) {
  return (
    <Chip
      label={STATUS_LABEL[status]}
      size="small"
      color={STATUS_COLOR[status]}
      variant="outlined"
      sx={{ height: 20, fontSize: "0.7rem" }}
    />
  );
}
