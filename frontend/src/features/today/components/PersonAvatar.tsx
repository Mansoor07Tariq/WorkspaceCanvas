import { Avatar } from "@mui/material";

import { initialsFromName } from "@/theme/tokens";
import { personAvatarSx } from "./PersonAvatar.styles";

interface Props {
  name: string;
  /** deterministic colour key — the occupant's user id (falls back to the name) */
  colorKey: number | string;
  size?: number;
  /** white ring, for stacked/overlapping avatars */
  ring?: boolean;
}

/**
 * A person tile: initials on a deterministic square-ish coloured tile (PR 079). The same
 * colleague is always the same colour across the map, near-you list, and week strip.
 * Visual styling lives in PersonAvatar.styles.ts (Layer 2).
 */
export function PersonAvatar({ name, colorKey, size = 28, ring = false }: Props) {
  return (
    <Avatar aria-hidden title={name} sx={personAvatarSx(size, colorKey, ring)}>
      {initialsFromName(name)}
    </Avatar>
  );
}
