import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { BusinessOutlined, LayersOutlined, MeetingRoomOutlined } from "@mui/icons-material";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { canManageWorkspaceContent } from "@/features/organizations/utils/membershipUtils";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { makeFloorBoundary } from "@/features/layoutObjects/utils/coordinateHelpers";
import { useBookingLocationSelection } from "@/features/bookings/hooks/useBookingLocationSelection";
import { BookingDateSelector } from "@/features/bookings/components/BookingDateSelector";
import {
  validateBookingDate,
  todayLocalDate,
  maxBookingDate,
} from "@/features/bookings/utils/bookingValidation";
import { useMeetingRooms } from "@/features/rooms/hooks/useMeetingRooms";
import { useRoomBookings } from "@/features/rooms/hooks/useRoomBookings";
import { createRoomBooking, cancelRoomBooking } from "@/features/rooms/api/roomApi";
import { RoomBookingCard } from "@/features/rooms/components/RoomBookingCard";
import { RoomBookingFloorMap } from "@/features/rooms/components/RoomBookingFloorMap";
import {
  buildRoomAvailabilityByLayoutObjectId,
  findRoomIdByLayoutObjectId,
} from "@/features/rooms/utils/roomAvailability";
import {
  durationOptionsFor,
  endTimeLabel,
  formatDuration,
  startTimeOptions,
  timeLabelToMinutes,
  MIN_DURATION_MIN,
} from "@/features/rooms/utils/roomTimeline";
import type { RoomBooking } from "@/features/rooms/types/room.types";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { ROUTES, officeDetailPath } from "@/routes/paths";
import { en } from "@/i18n/en";

const mapStartOptions = startTimeOptions();

const c = en.rooms;
const bc = en.bookings;

export function RoomBookingPage() {
  const navigate = useNavigate();
  const { selectedMembership, selectedOrganizationId } = useSelectedOrganization();
  const isOwnerOrAdmin = canManageWorkspaceContent(selectedMembership?.role);

  const {
    offices,
    officesLoading,
    officesError,
    floors,
    floorsLoading,
    floorsError,
    selectedOfficeId,
    selectedFloorId,
    selectedDate,
    selectedFloor,
    officeSelected,
    floorSelected,
    selectOffice,
    selectFloor,
    selectDate,
  } = useBookingLocationSelection(selectedOrganizationId);

  const floorOfficeId = typeof selectedOfficeId === "number" ? selectedOfficeId : 0;
  const roomFloorId = typeof selectedFloorId === "number" ? selectedFloorId : 0;

  const selectedOffice = offices.find((o) => o.id === floorOfficeId);
  const timeZone = selectedOffice?.timezone || "UTC";

  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
  } = useMeetingRooms(floorOfficeId, roomFloorId);
  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refresh: refreshBookings,
  } = useRoomBookings(floorOfficeId, roomFloorId, selectedDate);
  const { objects: layoutObjects } = useLayoutObjects(floorOfficeId, roomFloorId);

  const boundary =
    selectedFloor &&
    Number.isFinite(Number(selectedFloor.boundary_width)) &&
    Number.isFinite(Number(selectedFloor.boundary_height))
      ? makeFloorBoundary(
          Number(selectedFloor.boundary_width),
          Number(selectedFloor.boundary_height)
        )
      : undefined;

  const [actionRoomId, setActionRoomId] = useState<number | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingErrorRoomId, setBookingErrorRoomId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<RoomBooking | null>(null);

  // Page-level "show availability for" slot that colors the floor map (map only;
  // per-room booking still uses each card's own picker). Recolors on slot change.
  const [mapStart, setMapStart] = useState<string>(mapStartOptions[0] ?? "06:00");
  const [mapDuration, setMapDuration] = useState<number>(60);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const mapStartMin = timeLabelToMinutes(mapStart);
  const mapDurationOptions = durationOptionsFor(mapStartMin);
  const effectiveMapDuration = mapDurationOptions.includes(mapDuration)
    ? mapDuration
    : (mapDurationOptions[mapDurationOptions.length - 1] ?? MIN_DURATION_MIN);

  // Memoized so the canvas gets a STABLE availability prop: recomputed only when the
  // rooms/bookings/timezone/slot change — never per render/frame (PR 068 perf rule).
  // Deps are raw state/hook values (not derived consts) so React Compiler can keep
  // the manual memo (the review/13 lesson).
  const roomAvailabilityByLayoutObjectId = useMemo(() => {
    const startMin = timeLabelToMinutes(mapStart);
    const opts = durationOptionsFor(startMin);
    const dur = opts.includes(mapDuration)
      ? mapDuration
      : (opts[opts.length - 1] ?? MIN_DURATION_MIN);
    return buildRoomAvailabilityByLayoutObjectId(
      rooms,
      bookings,
      timeZone,
      startMin,
      startMin + dur
    );
  }, [rooms, bookings, timeZone, mapStart, mapDuration]);

  const selectedLayoutObjectId = useMemo(() => {
    const room = rooms.find((r) => r.id === selectedRoomId);
    return room?.layout_object ?? null;
  }, [rooms, selectedRoomId]);

  // Scroll the selected room's card into view when picked from the map.
  useEffect(() => {
    if (selectedRoomId === null) return;
    const el = document.getElementById(`room-anchor-${selectedRoomId}`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedRoomId]);

  function handleMapObjectSelect(layoutObjectId: number) {
    const roomId = findRoomIdByLayoutObjectId(rooms, layoutObjectId);
    if (roomId !== null) setSelectedRoomId(roomId);
  }

  function handleMapStartChange(value: string) {
    setMapStart(value);
    const opts = durationOptionsFor(timeLabelToMinutes(value));
    if (!opts.includes(mapDuration)) {
      setMapDuration(opts[opts.length - 1] ?? MIN_DURATION_MIN);
    }
  }

  const dateError = validateBookingDate(selectedDate);
  const dateErrorMessage = !dateError
    ? undefined
    : dateError === "past"
      ? bc.dateErrorPast
      : dateError === "tooFar"
        ? bc.dateErrorTooFar
        : bc.dateErrorInvalid;

  function handleOfficeChange(officeId: number | "") {
    selectOffice(officeId);
    setBookingError(null);
    setBookingErrorRoomId(null);
  }
  function handleFloorChange(floorId: number | "") {
    selectFloor(floorId);
    setBookingError(null);
    setBookingErrorRoomId(null);
  }
  function handleDateChange(date: string) {
    selectDate(date);
    setBookingError(null);
    setBookingErrorRoomId(null);
  }

  async function handleBook(roomId: number, start: string, end: string) {
    if (typeof selectedOfficeId !== "number" || typeof selectedFloorId !== "number") return;
    if (validateBookingDate(selectedDate) !== null) return;
    setActionRoomId(roomId);
    setBookingLoading(true);
    setBookingError(null);
    setBookingErrorRoomId(null);
    try {
      await createRoomBooking(selectedOfficeId, selectedFloorId, {
        room: roomId,
        booking_date: selectedDate,
        start,
        end,
      });
      refreshBookings();
    } catch (err: unknown) {
      setBookingError(getApiErrorMessage(err));
      setBookingErrorRoomId(roomId);
    } finally {
      setBookingLoading(false);
      setActionRoomId(null);
    }
  }

  async function confirmCancel() {
    const booking = pendingCancel;
    if (
      booking === null ||
      typeof selectedOfficeId !== "number" ||
      typeof selectedFloorId !== "number"
    ) {
      setPendingCancel(null);
      return;
    }
    setActionRoomId(booking.room);
    setCancelLoading(true);
    setBookingError(null);
    setBookingErrorRoomId(null);
    try {
      await cancelRoomBooking(selectedOfficeId, selectedFloorId, booking.id);
      refreshBookings();
    } catch (err: unknown) {
      setBookingError(getApiErrorMessage(err));
      setBookingErrorRoomId(booking.room);
    } finally {
      setCancelLoading(false);
      setActionRoomId(null);
      setPendingCancel(null);
    }
  }

  // Active bookings for the day, grouped by room (masked by the API — render as-is).
  const bookingsByRoom = new Map<number, RoomBooking[]>();
  for (const b of bookings) {
    if (b.status !== "active") continue;
    const list = bookingsByRoom.get(b.room) ?? [];
    list.push(b);
    bookingsByRoom.set(b.room, list);
  }

  const noOfficesReady = !officesLoading && !officesError && offices.length === 0;
  const noFloorsReady = officeSelected && !floorsLoading && !floorsError && floors.length === 0;
  const dataLoading = roomsLoading || bookingsLoading;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {c.pageTitle}
      </Typography>

      {noOfficesReady && (
        <EmptyState
          icon={<BusinessOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
          title={isOwnerOrAdmin ? c.noOfficesAdminTitle : c.noOfficesMemberTitle}
          description={isOwnerOrAdmin ? c.noOfficesAdminDesc : c.noOfficesMemberDesc}
          actionLabel={isOwnerOrAdmin ? c.noOfficesAdminAction : undefined}
          onAction={isOwnerOrAdmin ? () => navigate(ROUTES.offices) : undefined}
        />
      )}

      {!noOfficesReady && noFloorsReady && (
        <EmptyState
          icon={<LayersOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
          title={isOwnerOrAdmin ? c.noFloorsAdminTitle : c.noFloorsMemberTitle}
          description={isOwnerOrAdmin ? c.noFloorsAdminDesc : c.noFloorsMemberDesc}
          actionLabel={isOwnerOrAdmin ? c.noFloorsAdminAction : undefined}
          onAction={
            isOwnerOrAdmin && typeof selectedOfficeId === "number"
              ? () => navigate(officeDetailPath(selectedOfficeId))
              : undefined
          }
        />
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        {officesError && <Alert severity="error">{officesError}</Alert>}

        <FormControl size="small" sx={{ minWidth: 200 }} disabled={officesLoading}>
          <InputLabel id="room-office-select-label">Office</InputLabel>
          <Select
            labelId="room-office-select-label"
            label="Office"
            value={selectedOfficeId}
            onChange={(e) => handleOfficeChange(e.target.value as number | "")}
            data-testid="office-select"
          >
            <MenuItem value="">
              <em>Select office</em>
            </MenuItem>
            {offices.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl
          size="small"
          sx={{ minWidth: 200 }}
          disabled={!selectedOfficeId || floorsLoading}
        >
          <InputLabel id="room-floor-select-label">Floor</InputLabel>
          <Select
            labelId="room-floor-select-label"
            label="Floor"
            value={selectedFloorId}
            onChange={(e) => handleFloorChange(e.target.value as number | "")}
            data-testid="floor-select"
          >
            <MenuItem value="">
              <em>Select floor</em>
            </MenuItem>
            {floors.map((f) => (
              <MenuItem key={f.id} value={f.id}>
                {f.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <BookingDateSelector
          value={selectedDate}
          onChange={handleDateChange}
          minDate={todayLocalDate()}
          maxDate={maxBookingDate()}
          disabled={!floorSelected}
          error={dateErrorMessage}
        />
      </Stack>

      {floorsError && <ErrorAlert message={floorsError} />}
      {bookingsError && <ErrorAlert message={c.errorLoadingBookings} />}

      {floorSelected && (
        <>
          {dataLoading ? (
            <LoadingState message={c.loadingRooms} />
          ) : roomsError ? (
            <Alert severity="error" role="alert">
              {c.errorLoadingRooms}
            </Alert>
          ) : rooms.length === 0 ? (
            <EmptyState
              icon={<MeetingRoomOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
              title={c.noRoomsTitle}
              description={isOwnerOrAdmin ? c.noRoomsAdminDesc : c.noRoomsMemberDesc}
            />
          ) : (
            <Stack spacing={2}>
              {/* Floor map colored by the chosen availability slot (PR 075). */}
              {layoutObjects.length > 0 && (
                <Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ mb: 1, alignItems: { sm: "center" } }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {c.mapSlotLabel}
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel id="map-start-label">{c.startLabel}</InputLabel>
                      <Select
                        labelId="map-start-label"
                        label={c.startLabel}
                        value={mapStart}
                        onChange={(e) => handleMapStartChange(String(e.target.value))}
                        data-testid="map-start-select"
                      >
                        {mapStartOptions.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel id="map-duration-label">{c.durationLabel}</InputLabel>
                      <Select
                        labelId="map-duration-label"
                        label={c.durationLabel}
                        value={effectiveMapDuration}
                        onChange={(e) => setMapDuration(Number(e.target.value))}
                        data-testid="map-duration-select"
                      >
                        {mapDurationOptions.map((d) => (
                          <MenuItem key={d} value={d}>
                            {formatDuration(d, { hour: c.unitHour, minute: c.unitMinute })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary">
                      {mapStart}–{endTimeLabel(mapStart, effectiveMapDuration)}
                    </Typography>
                  </Stack>
                  <RoomBookingFloorMap
                    layoutObjects={layoutObjects}
                    availabilityByLayoutObjectId={roomAvailabilityByLayoutObjectId}
                    selectedLayoutObjectId={selectedLayoutObjectId}
                    onObjectSelect={handleMapObjectSelect}
                    boundary={boundary}
                  />
                </Box>
              )}

              {dateError && <Alert severity="warning">{c.dateInvalidNote}</Alert>}
              {rooms.map((room) => (
                <Box key={room.id} id={`room-anchor-${room.id}`}>
                  <RoomBookingCard
                    room={room}
                    bookings={bookingsByRoom.get(room.id) ?? []}
                    timeZone={timeZone}
                    bookingDisabled={dateError !== null}
                    highlighted={selectedRoomId === room.id}
                    loading={actionRoomId === room.id && (bookingLoading || cancelLoading)}
                    error={bookingErrorRoomId === room.id ? bookingError : null}
                    onBook={handleBook}
                    onCancel={(bookingId) => {
                      const target = bookings.find((b) => b.id === bookingId) ?? null;
                      setPendingCancel(target);
                    }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}

      {!floorSelected && !officesLoading && !noOfficesReady && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            {c.selectPrompt}
          </Typography>
        </Box>
      )}

      <ConfirmDialog
        open={pendingCancel !== null}
        title={c.cancelConfirmTitle}
        message={c.cancelConfirmMessage}
        confirmLabel={c.cancelConfirmConfirm}
        cancelLabel={c.cancelConfirmDismiss}
        destructive
        loading={cancelLoading}
        onConfirm={confirmCancel}
        onClose={() => setPendingCancel(null)}
      />
    </Container>
  );
}
