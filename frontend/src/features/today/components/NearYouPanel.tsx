import { Box, Button, Stack, Typography } from "@mui/material";
import { CheckOutlined } from "@mui/icons-material";

import { en } from "@/i18n/en";
import { deskLabel, interpolate } from "../utils/todayLogic";
import type { OccupantPoint } from "../utils/todayLogic";
import { PersonAvatar } from "./PersonAvatar";
import * as s from "./NearYouPanel.styles";

interface Props {
  dayLabel: string;
  /** ≤3 ranked occupants (nearest first) */
  nearby: OccupantPoint[];
  /** total others in the office that day (for the "+N more" link) */
  totalOthers: number;
  freeCount: number;
  myDeskCode: string | null;
  highlightedDeskId: number | null;
  onHighlight: (deskId: number | null) => void;
  onBook: () => void;
  onViewFullFloor: () => void;
}

/**
 * "Near you" — up to 3 colleagues ranked by distance from your desk (PR 079). Hovering a
 * person highlights their row and dims the others; on touch, tapping toggles the
 * highlight. The desk number text is always shown so hover is never the only way to
 * locate someone (a11y). `onHighlight` also surfaces the desk id for map-side dimming.
 */
export function NearYouPanel({
  dayLabel,
  nearby,
  totalOthers,
  freeCount,
  myDeskCode,
  highlightedDeskId,
  onHighlight,
  onBook,
  onViewFullFloor,
}: Props) {
  const extra = totalOthers - nearby.length;

  return (
    <Stack sx={{ height: "100%" }}>
      <Typography variant="caption" sx={s.eyebrow}>
        {en.app.today.nearYouTitle} · {dayLabel}
      </Typography>

      {nearby.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {myDeskCode ? en.app.today.justYouSoFar : en.app.today.nobodyYet}
        </Typography>
      ) : (
        <Stack spacing={0.5} role="list">
          {nearby.map((o) => {
            const dimmed = highlightedDeskId != null && highlightedDeskId !== o.deskId;
            const active = highlightedDeskId === o.deskId;
            return (
              <Stack
                key={o.deskId}
                role="listitem"
                data-dimmed={dimmed ? "true" : "false"}
                data-active={active ? "true" : "false"}
                direction="row"
                spacing={1.25}
                onMouseEnter={() => onHighlight(o.deskId)}
                onMouseLeave={() => onHighlight(null)}
                onClick={() => onHighlight(active ? null : o.deskId)}
                sx={s.row(active, dimmed)}
              >
                <PersonAvatar name={o.userName} colorKey={o.userId ?? o.userName} size={27} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={s.name}>
                    {o.userName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {deskLabel(o.deskId)}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      )}

      {extra > 0 && (
        <Button onClick={onViewFullFloor} variant="text" sx={s.moreLink}>
          {interpolate(en.app.today.moreInOffice, { count: extra })} →
        </Button>
      )}

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={s.footer}>
        {myDeskCode ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <CheckOutlined color="primary" fontSize="small" />
            <Typography variant="body2" sx={s.bookedText}>
              {interpolate(en.app.today.youreAtDesk, { desk: deskLabel(myDeskCode) })}
            </Typography>
          </Stack>
        ) : (
          <Button fullWidth variant="contained" onClick={onBook} sx={s.bookButton}>
            {interpolate(en.app.today.bookForDay, { day: dayLabel, count: freeCount })}
          </Button>
        )}
      </Box>
    </Stack>
  );
}
