import { Box, Skeleton, Stack, Typography } from "@mui/material";

import { en } from "@/i18n/en";
import { deskLabel } from "../utils/todayLogic";
import type { DaySummary } from "../hooks/useTodayData";
import { PersonAvatar } from "./PersonAvatar";
import * as s from "./WeekStrip.styles";

interface Props {
  days: DaySummary[];
  selectedIndex: number;
  onSelectDay: (index: number) => void;
}

/**
 * The Mon–Fri week strip (PR 079). Each card is the map's day selector: tapping it flips
 * the map + near-you above to that day. A card shows the Fraunces day number, the
 * viewer's status (Desk N / + Book), and up to 4 stacked avatars of who's in that day.
 */
export function WeekStrip({ days, selectedIndex, onSelectDay }: Props) {
  return (
    <Box>
      <Typography variant="body2" sx={s.title}>
        {en.app.today.weekTitle}{" "}
        <Typography component="span" variant="body2" color="text.secondary" sx={s.hint}>
          · {en.app.today.weekHint}
        </Typography>
      </Typography>
      <Box role="tablist" aria-label={en.app.today.weekTitle} sx={s.grid}>
        {days.map((summary, idx) => {
          const active = idx === selectedIndex;
          const booked = summary.myBooking != null;
          const activeBooked = active && booked;
          const others = summary.others;

          return (
            <Box
              key={summary.day.iso}
              role="tab"
              aria-selected={active}
              aria-label={`${summary.day.dayLabel} ${summary.day.dayNumber}`}
              tabIndex={0}
              onClick={() => onSelectDay(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(idx);
                }
              }}
              sx={s.dayCard(active, booked)}
            >
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
                <Typography sx={s.dayNumber(activeBooked)}>{summary.day.dayNumber}</Typography>
                <Typography variant="caption" sx={s.dayLabel(activeBooked)}>
                  {summary.day.dayLabel}
                </Typography>
              </Stack>

              <Typography variant="body2" sx={s.status(activeBooked, booked)}>
                {summary.loading ? (
                  <Skeleton width={54} />
                ) : booked ? (
                  deskLabel(summary.myBooking!.desk_code || summary.myBooking!.desk_name)
                ) : (
                  en.app.today.statusBook
                )}
              </Typography>

              <Stack direction="row" sx={{ minHeight: 21 }}>
                {others.slice(0, 4).map((b, k) => (
                  <Box key={b.id} sx={{ ml: k ? "-7px" : 0, display: "inline-flex" }}>
                    <PersonAvatar
                      name={b.user_name}
                      colorKey={b.user ?? b.user_name}
                      size={21}
                      ring
                    />
                  </Box>
                ))}
                {others.length > 4 && (
                  <Typography variant="caption" sx={s.overflowCount(activeBooked)}>
                    +{others.length - 4}
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
