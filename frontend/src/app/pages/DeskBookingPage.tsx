import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { BusinessOutlined, LayersOutlined, WeekendOutlined } from "@mui/icons-material";
import { canManageWorkspaceContent } from "@/features/organizations/utils/membershipUtils";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useOffices } from "@/features/offices/hooks/useOffices";
import { useFloors } from "@/features/floors/hooks/useFloors";
import { useDesks } from "@/features/desks/hooks/useDesks";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useDeskBookings } from "@/features/bookings/hooks/useDeskBookings";
import { createDeskBooking, cancelDeskBooking } from "@/features/bookings/api/bookingApi";
import { useBookingAvailability } from "@/features/bookings/hooks/useBookingAvailability";
import { BookingDateSelector } from "@/features/bookings/components/BookingDateSelector";
import { BookingSummaryCards } from "@/features/bookings/components/BookingSummaryCards";
import { DeskAvailabilityList } from "@/features/bookings/components/DeskAvailabilityList";
import { SelectedDeskBookingPanel } from "@/features/bookings/components/SelectedDeskBookingPanel";
import { BookingFloorMap } from "@/features/bookings/components/BookingFloorMap";
import { ApiError } from "@/lib/api/apiClient";
import { ROUTES, officeDetailPath } from "@/routes/paths";
import { en } from "@/i18n/en";

function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${mm}-${dd}`;
}

function extractBookingError(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data["detail"] === "string") {
        return data["detail"];
      }
      const nonFieldErrors = data["non_field_errors"];
      if (Array.isArray(nonFieldErrors) && nonFieldErrors.length > 0) {
        return nonFieldErrors.join(" ");
      }
    }
    if (err.status === 409) {
      return "This desk is already booked for this date.";
    }
    if (err.status === 403) {
      return "You do not have permission to book this desk.";
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "An unexpected error occurred.";
}

const c = en.bookings;

export function DeskBookingPage() {
  const navigate = useNavigate();
  // PR 055: booking context follows the selected organization.
  const { selectedMembership, selectedOrganizationId } = useSelectedOrganization();
  const isOwnerOrAdmin = canManageWorkspaceContent(selectedMembership?.role);

  const [selectedOfficeId, setSelectedOfficeId] = useState<number | "">("");
  const [selectedFloorId, setSelectedFloorId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [selectedDeskId, setSelectedDeskId] = useState<number | null>(null);

  const [bookingLoading, setBookingLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const {
    offices,
    loading: officesLoading,
    error: officesError,
  } = useOffices(selectedOrganizationId);

  const floorOfficeId = typeof selectedOfficeId === "number" ? selectedOfficeId : 0;
  const { floors, loading: floorsLoading, error: floorsError } = useFloors(floorOfficeId);

  const deskFloorId = typeof selectedFloorId === "number" ? selectedFloorId : 0;
  const { desks, loading: desksLoading, error: desksError } = useDesks(floorOfficeId, deskFloorId);
  const {
    objects: layoutObjects,
    loading: layoutLoading,
    error: layoutError,
  } = useLayoutObjects(floorOfficeId, deskFloorId);

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refresh: refreshBookings,
  } = useDeskBookings(floorOfficeId, deskFloorId, selectedDate);

  // useDeskBookings already re-fetches autonomously when officeId/floorId/date change;
  // no manual useEffect is needed here.

  const bookingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bookingTimerRef.current !== null) clearTimeout(bookingTimerRef.current);
      if (cancelTimerRef.current !== null) clearTimeout(cancelTimerRef.current);
    };
  }, []);

  const { items, counts, myBooking } = useBookingAvailability(desks, bookings, layoutObjects);

  const selectedItem =
    selectedDeskId !== null ? (items.find((i) => i.desk.id === selectedDeskId) ?? null) : null;

  function handleSelectDesk(deskId: number) {
    setSelectedDeskId(deskId);
    setBookingSuccess(false);
    setCancelSuccess(false);
    setBookingError(null);
    setCancelError(null);
  }

  // Reset floor/desk when office changes
  function handleOfficeChange(officeId: number | "") {
    setSelectedOfficeId(officeId);
    setSelectedFloorId("");
    setSelectedDeskId(null);
    setBookingSuccess(false);
    setCancelSuccess(false);
    setBookingError(null);
    setCancelError(null);
  }

  // Reset desk when floor changes
  function handleFloorChange(floorId: number | "") {
    setSelectedFloorId(floorId);
    setSelectedDeskId(null);
    setBookingError(null);
    setCancelError(null);
    setBookingSuccess(false);
    setCancelSuccess(false);
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedDeskId(null);
    setBookingError(null);
    setCancelError(null);
    setBookingSuccess(false);
    setCancelSuccess(false);
  }

  async function handleBook(deskId: number) {
    if (typeof selectedOfficeId !== "number" || typeof selectedFloorId !== "number") return;
    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(false);
    try {
      await createDeskBooking(selectedOfficeId, selectedFloorId, {
        desk: deskId,
        booking_date: selectedDate,
      });
      refreshBookings();
      setBookingSuccess(true);
      if (bookingTimerRef.current !== null) clearTimeout(bookingTimerRef.current);
      bookingTimerRef.current = setTimeout(() => setBookingSuccess(false), 3000);
    } catch (err: unknown) {
      setBookingError(extractBookingError(err));
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleCancel(bookingId: number) {
    if (typeof selectedOfficeId !== "number" || typeof selectedFloorId !== "number") return;
    setCancelLoading(true);
    setCancelError(null);
    setCancelSuccess(false);
    try {
      await cancelDeskBooking(selectedOfficeId, selectedFloorId, bookingId);
      refreshBookings();
      setCancelSuccess(true);
      if (cancelTimerRef.current !== null) clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = setTimeout(() => setCancelSuccess(false), 3000);
    } catch (err: unknown) {
      setCancelError(extractBookingError(err));
    } finally {
      setCancelLoading(false);
    }
  }

  const floorSelected = typeof selectedFloorId === "number" && selectedFloorId > 0;
  const dataLoading = desksLoading || layoutLoading || bookingsLoading;

  // No-offices empty state — shown before the selector panel
  const noOfficesReady = !officesLoading && !officesError && offices.length === 0;

  // No-floors empty state — shown when an office is selected but has no floors
  const officeSelected = typeof selectedOfficeId === "number" && selectedOfficeId > 0;
  const noFloorsReady = officeSelected && !floorsLoading && !floorsError && floors.length === 0;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {c.pageTitle}
      </Typography>

      {/* Role-aware empty state: no offices exist yet */}
      {noOfficesReady && (
        <EmptyState
          icon={<BusinessOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
          title={isOwnerOrAdmin ? c.noOfficesAdminTitle : c.noOfficesMemberTitle}
          description={isOwnerOrAdmin ? c.noOfficesAdminDesc : c.noOfficesMemberDesc}
          actionLabel={isOwnerOrAdmin ? c.noOfficesAdminAction : undefined}
          onAction={isOwnerOrAdmin ? () => navigate(ROUTES.offices) : undefined}
        />
      )}

      {/* Role-aware empty state: office selected but no floors */}
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

      {/* Selector panel — always rendered so the user can change their selection */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        {officesError && <Alert severity="error">{officesError}</Alert>}

        <FormControl size="small" sx={{ minWidth: 200 }} disabled={officesLoading}>
          <InputLabel id="office-select-label">Office</InputLabel>
          <Select
            labelId="office-select-label"
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
          <InputLabel id="floor-select-label">Floor</InputLabel>
          <Select
            labelId="floor-select-label"
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
          minDate={getTodayLocalDate()}
          disabled={!floorSelected}
        />
      </Stack>

      {floorsError && <ErrorAlert message={floorsError} />}
      {bookingsError && <ErrorAlert message={bookingsError} />}

      {floorSelected && (
        <>
          {dataLoading ? (
            <LoadingState message="Loading desk availability..." />
          ) : (
            <>
              {desksError && (
                <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                  Failed to load desks. Please try again.
                </Alert>
              )}
              {layoutError && (
                <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                  Failed to load floor layout. Please try again.
                </Alert>
              )}
              {/* No bookable desks on this floor yet */}
              {items.length === 0 && !desksError && (
                <EmptyState
                  icon={<WeekendOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
                  title={c.noDesksTitle}
                  description={isOwnerOrAdmin ? c.noDesksAdminDesc : c.noDesksMemberDesc}
                  actionLabel={isOwnerOrAdmin ? c.noDesksAdminAction : undefined}
                  onAction={
                    isOwnerOrAdmin &&
                    typeof selectedOfficeId === "number" &&
                    typeof selectedFloorId === "number"
                      ? () =>
                          navigate(
                            `/app/offices/${selectedOfficeId}/floors/${selectedFloorId}/layout`
                          )
                      : undefined
                  }
                />
              )}

              {items.length > 0 && (
                <BookingSummaryCards
                  availableCount={counts.available}
                  reservedCount={counts.reserved}
                  unavailableCount={counts.unavailable}
                  myBooking={counts.myBooking}
                />
              )}

              {layoutObjects.length > 0 && items.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Floor map
                  </Typography>
                  <BookingFloorMap
                    items={items}
                    layoutObjects={layoutObjects}
                    selectedDeskId={selectedDeskId}
                    onDeskSelect={handleSelectDesk}
                  />
                </Box>
              )}

              {items.length > 0 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <DeskAvailabilityList
                      items={items}
                      selectedDeskId={selectedDeskId}
                      onSelectDesk={handleSelectDesk}
                      onBookDesk={handleBook}
                      onCancelBooking={handleCancel}
                      hasMyBooking={myBooking !== null}
                      bookingLoading={bookingLoading}
                      cancelLoading={cancelLoading}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <SelectedDeskBookingPanel
                      item={selectedItem}
                      selectedDate={selectedDate}
                      hasMyBooking={myBooking !== null}
                      onBook={handleBook}
                      onCancel={handleCancel}
                      bookingLoading={bookingLoading}
                      cancelLoading={cancelLoading}
                      bookingError={bookingError}
                      cancelError={cancelError}
                      bookingSuccess={bookingSuccess}
                      cancelSuccess={cancelSuccess}
                    />
                  </Grid>
                </Grid>
              )}
            </>
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
    </Container>
  );
}
