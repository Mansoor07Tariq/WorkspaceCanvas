import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { WeekendOutlined } from "@mui/icons-material";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useOffices } from "@/features/offices/hooks/useOffices";
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { useMyRoomBookings } from "@/features/rooms/hooks/useMyRoomBookings";
import { cancelMyBooking } from "@/features/bookings/api/bookingApi";
import { cancelRoomBooking } from "@/features/rooms/api/roomApi";
import { MyBookingsList } from "@/features/bookings/components/MyBookingsList";
import { mergeMyBookings } from "@/features/bookings/utils/mergeMyBookings";
import { groupMyBookings, type MyBookingsTab } from "@/features/bookings/utils/groupMyBookings";
import type { MyBooking } from "@/features/bookings/types/myBookings.types";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { deskBookingPath, roomBookingPath } from "@/routes/paths";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";

const c = en.myBookings;
const cb = en.bookings;

/** Local calendar date as YYYY-MM-DD (no timezone shift). */
function todayLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function MyBookingsPage() {
  const navigate = useNavigate();
  const { selectedOrganizationId } = useSelectedOrganization();
  const [tab, setTab] = useState<MyBookingsTab>("upcoming");
  const [pendingCancel, setPendingCancel] = useState<MyBooking | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
  const [cancelError, setCancelError] = useState<string | undefined>();

  // Two clean endpoints, merged client-side. Each can fail independently — the
  // page shows whichever half loaded plus an inline error, never a blank screen.
  const {
    bookings: deskBookings,
    loading: deskLoading,
    error: deskError,
    refresh: refreshDesks,
  } = useMyBookings({ status: "all" });
  const {
    bookings: roomBookings,
    loading: roomLoading,
    error: roomError,
    refresh: refreshRooms,
  } = useMyRoomBookings({ status: "all" });

  // Offices of the selected org supply room timezones (office-local time labels).
  const { offices } = useOffices(selectedOrganizationId);
  const officeTz = useMemo(() => {
    const map = new Map<number, string>();
    for (const o of offices) map.set(o.id, o.timezone ?? "");
    return map;
  }, [offices]);
  const resolveTimeZone = (officeId: number): string => officeTz.get(officeId) ?? "";

  const merged = useMemo(
    () => mergeMyBookings(deskBookings, roomBookings),
    [deskBookings, roomBookings]
  );
  const groups = useMemo(() => groupMyBookings(merged, todayLocal()), [merged]);
  const current = groups[tab];

  const loading = deskLoading || roomLoading;

  function handleBookAgain(booking: MyBooking) {
    if (booking.resource_type === "room") {
      navigate(roomBookingPath({ office: booking.office, floor: booking.floor }));
    } else {
      navigate(
        deskBookingPath({ office: booking.office, floor: booking.floor, desk: booking.desk })
      );
    }
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    const booking = pendingCancel;
    setCancellingId(booking.id);
    setCancelSuccess(undefined);
    setCancelError(undefined);
    try {
      if (booking.resource_type === "room") {
        await cancelRoomBooking(booking.office, booking.floor, booking.id);
        refreshRooms();
      } else {
        await cancelMyBooking(booking.id);
        refreshDesks();
      }
      setCancelSuccess(c.cancelSuccess);
      setPendingCancel(null);
    } catch (err) {
      setCancelError(getApiErrorMessage(err));
      setPendingCancel(null);
    } finally {
      setCancellingId(null);
    }
  }

  const counts = {
    upcoming: groups.upcoming.length,
    past: groups.past.length,
    cancelled: groups.cancelled.length,
  };
  const emptyCopy: Record<MyBookingsTab, { title: string; desc: string }> = {
    upcoming: { title: c.emptyTitle, desc: c.emptyDesc },
    past: { title: c.emptyPastTitle, desc: c.emptyPastDesc },
    cancelled: { title: c.emptyCancelledTitle, desc: c.emptyCancelledDesc },
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 } }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
          {c.pageTitle}
        </Typography>
        <Button variant="contained" onClick={() => navigate(deskBookingPath())}>
          {c.bookDeskAction}
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v: MyBookingsTab) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        aria-label={c.pageTitle}
      >
        <Tab value="upcoming" label={`${c.tabUpcoming} (${counts.upcoming})`} />
        <Tab value="past" label={`${c.tabPast} (${counts.past})`} />
        <Tab value="cancelled" label={`${c.tabCancelled} (${counts.cancelled})`} />
      </Tabs>

      {cancelSuccess && (
        <Alert
          severity="success"
          role="alert"
          sx={{ mb: 2 }}
          onClose={() => setCancelSuccess(undefined)}
        >
          {cancelSuccess}
        </Alert>
      )}
      {cancelError && (
        <Alert
          severity="error"
          role="alert"
          sx={{ mb: 2 }}
          onClose={() => setCancelError(undefined)}
        >
          {cancelError}
        </Alert>
      )}
      {/* Partial-failure: one endpoint down shows an inline error over the loaded half. */}
      {deskError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {c.deskLoadError}
        </Alert>
      )}
      {roomError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {c.roomLoadError}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Loading bookings" />
        </Box>
      )}

      {!loading && current.length === 0 && (
        <EmptyState
          icon={<WeekendOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
          title={emptyCopy[tab].title}
          description={emptyCopy[tab].desc}
          actionLabel={tab === "upcoming" ? c.bookDeskAction : undefined}
          onAction={tab === "upcoming" ? () => navigate(deskBookingPath()) : undefined}
        />
      )}

      {!loading && current.length > 0 && (
        <MyBookingsList
          bookings={current}
          onCancel={tab === "upcoming" ? (booking) => setPendingCancel(booking) : undefined}
          onBookAgain={handleBookAgain}
          cancellingId={cancellingId}
          resolveTimeZone={resolveTimeZone}
        />
      )}

      <ConfirmDialog
        open={pendingCancel !== null}
        title={cb.cancelConfirmTitle}
        message={cb.cancelConfirmMessage}
        confirmLabel={cb.cancelConfirmConfirm}
        cancelLabel={cb.cancelConfirmDismiss}
        destructive
        loading={cancellingId !== null}
        onConfirm={confirmCancel}
        onClose={() => setPendingCancel(null)}
      />
    </Container>
  );
}
