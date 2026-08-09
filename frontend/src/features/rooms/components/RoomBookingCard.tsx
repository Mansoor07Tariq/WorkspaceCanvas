import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import type { MeetingRoom, RoomBooking } from "../types/room.types";
import {
  buildTimelineSegments,
  durationOptionsFor,
  endTimeLabel,
  formatDuration,
  hourTicks,
  minutesToTimeLabel,
  slotConflicts,
  startTimeOptions,
  timeLabelToMinutes,
  MIN_DURATION_MIN,
} from "../utils/roomTimeline";

const c = en.rooms;

interface Props {
  room: MeetingRoom;
  /** This room's ACTIVE bookings for the selected day. */
  bookings: RoomBooking[];
  /** Office IANA timezone (empty → "UTC", matching the backend default). */
  timeZone: string;
  /** Disables Book regardless of slot (e.g. the selected date is invalid). */
  bookingDisabled: boolean;
  /** This room's book/cancel request is in flight. */
  loading: boolean;
  /** Server error to surface on THIS room's card. */
  error: string | null;
  /** Highlight this card (selected from the floor map). */
  highlighted?: boolean;
  onBook: (roomId: number, start: string, end: string) => void;
  onCancel: (bookingId: number) => void;
}

const startOptions = startTimeOptions();
const ticks = hourTicks();

export function RoomBookingCard({
  room,
  bookings,
  timeZone,
  bookingDisabled,
  loading,
  error,
  highlighted = false,
  onBook,
  onCancel,
}: Props) {
  const [start, setStart] = useState<string>(startOptions[0] ?? "06:00");
  const [duration, setDuration] = useState<number>(MIN_DURATION_MIN);

  const available = room.status === "available";
  const durationOptions = durationOptionsFor(timeLabelToMinutes(start));
  // Keep the chosen duration valid for the chosen start (late starts cap it).
  const effectiveDuration = durationOptions.includes(duration)
    ? duration
    : (durationOptions[durationOptions.length - 1] ?? MIN_DURATION_MIN);

  const startMin = timeLabelToMinutes(start);
  const endMin = startMin + effectiveDuration;
  const end = endTimeLabel(start, effectiveDuration);
  const conflict = slotConflicts(bookings, timeZone, startMin, endMin);
  const segments = buildTimelineSegments(bookings, timeZone);

  const bookDisabled = bookingDisabled || loading || !available || conflict;

  function handleStartChange(value: string) {
    setStart(value);
    const opts = durationOptionsFor(timeLabelToMinutes(value));
    if (!opts.includes(duration)) {
      setDuration(opts[opts.length - 1] ?? MIN_DURATION_MIN);
    }
  }

  return (
    <Card
      variant="outlined"
      data-testid={`room-card-${room.id}`}
      sx={{
        borderColor: highlighted ? "primary.main" : "divider",
        borderWidth: highlighted ? 2 : 1,
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {room.name}
          </Typography>
          <Chip size="small" label={`${c.capacityLabel}: ${room.capacity}`} />
        </Stack>

        {/* Read-only day timeline (office-local). Also readable via the text list
            and the slot picker below (a11y). */}
        <Box
          sx={{
            position: "relative",
            height: 40,
            borderRadius: 1,
            bgcolor: "action.hover",
            border: 1,
            borderColor: "divider",
            overflow: "hidden",
          }}
          role="img"
          aria-label={`${room.name} ${c.bookedTimesLabel.toLowerCase()}`}
        >
          {ticks.map((t) => {
            const total =
              timeLabelToMinutes(ticks[ticks.length - 1]) - timeLabelToMinutes(ticks[0]);
            const left =
              total > 0
                ? ((timeLabelToMinutes(t) - timeLabelToMinutes(ticks[0])) / total) * 100
                : 0;
            return (
              <Box
                key={t}
                sx={{
                  position: "absolute",
                  left: `${left}%`,
                  top: 0,
                  bottom: 0,
                  borderLeft: 1,
                  borderColor: "divider",
                  opacity: 0.5,
                }}
              />
            );
          })}
          {segments.map((seg) => {
            const label = seg.status === "mine" ? c.statusMine : c.statusReserved;
            const aria = `${label} ${seg.startLabel}–${seg.endLabel}`;
            return seg.status === "mine" ? (
              <Box
                key={seg.bookingId}
                component="button"
                type="button"
                onClick={() => onCancel(seg.bookingId)}
                aria-label={`${aria}. ${c.cancelAction}`}
                data-testid={`room-segment-${seg.bookingId}`}
                sx={{
                  position: "absolute",
                  left: `${seg.leftPct}%`,
                  width: `${seg.widthPct}%`,
                  top: 4,
                  bottom: 4,
                  p: 0,
                  border: 0,
                  borderRadius: 0.5,
                  cursor: "pointer",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  fontSize: 10,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Box>
            ) : (
              <Box
                key={seg.bookingId}
                aria-label={aria}
                data-testid={`room-segment-${seg.bookingId}`}
                sx={{
                  position: "absolute",
                  left: `${seg.leftPct}%`,
                  width: `${seg.widthPct}%`,
                  top: 4,
                  bottom: 4,
                  borderRadius: 0.5,
                  bgcolor: "grey.500",
                  color: "common.white",
                  fontSize: 10,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  px: 0.5,
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
        <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.5, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {ticks[0]}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ticks[ticks.length - 1]}
          </Typography>
        </Stack>

        {/* Text alternative for the timeline (a11y — never relies on colour alone). */}
        <Box sx={{ mb: 1.5 }} data-testid={`room-booked-list-${room.id}`}>
          <Typography variant="caption" color="text.secondary" component="p">
            {c.bookedTimesLabel}:
          </Typography>
          {segments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {c.noBookingsYet}
            </Typography>
          ) : (
            <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2.5 }}>
              {segments.map((seg) => (
                <li key={seg.bookingId}>
                  {seg.startLabel}–{seg.endLabel} (
                  {seg.status === "mine" ? c.statusMine : c.statusReserved})
                </li>
              ))}
            </Typography>
          )}
        </Box>

        {!available ? (
          <Alert severity="info">{c.roomUnavailable}</Alert>
        ) : (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1 }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id={`start-label-${room.id}`}>{c.startLabel}</InputLabel>
                <Select
                  labelId={`start-label-${room.id}`}
                  label={c.startLabel}
                  value={start}
                  onChange={(e) => handleStartChange(String(e.target.value))}
                  data-testid={`room-start-select-${room.id}`}
                >
                  {startOptions.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id={`duration-label-${room.id}`}>{c.durationLabel}</InputLabel>
                <Select
                  labelId={`duration-label-${room.id}`}
                  label={c.durationLabel}
                  value={effectiveDuration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  data-testid={`room-duration-select-${room.id}`}
                >
                  {durationOptions.map((d) => (
                    <MenuItem key={d} value={d}>
                      {formatDuration(d, { hour: c.unitHour, minute: c.unitMinute })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                disabled={bookDisabled}
                onClick={() => onBook(room.id, start, end)}
                startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
                data-testid={`room-book-${room.id}`}
                aria-label={`${c.bookAction} ${room.name} ${start}–${end}`}
                sx={{ alignSelf: { sm: "stretch" } }}
              >
                {c.bookAction} {minutesToTimeLabel(startMin)}–{end}
              </Button>
            </Stack>

            {conflict && (
              <Typography variant="caption" color="error" data-testid={`room-conflict-${room.id}`}>
                {c.conflictReason}
              </Typography>
            )}
            {error && (
              <Alert
                severity="error"
                role="alert"
                sx={{ mt: 1 }}
                data-testid={`room-error-${room.id}`}
              >
                {error}
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
