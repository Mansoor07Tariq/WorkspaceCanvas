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
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { cancelMyBooking } from "@/features/bookings/api/bookingApi";
import { MyBookingsList } from "@/features/bookings/components/MyBookingsList";
import { groupMyBookings, type MyBookingsTab } from "@/features/bookings/utils/groupMyBookings";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES, deskBookingPath } from "@/routes/paths";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import type { DeskBooking } from "@/features/bookings/types/booking.types";

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
  const [tab, setTab] = useState<MyBookingsTab>("upcoming");
  const [pendingCancel, setPendingCancel] = useState<DeskBooking | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
  const [cancelError, setCancelError] = useState<string | undefined>();

  // One fetch for the whole history; the three views are a pure client-side split.
  const { bookings, loading, error, refresh } = useMyBookings({ status: "all" });
  const groups = useMemo(() => groupMyBookings(bookings, todayLocal()), [bookings]);
  const current = groups[tab];

  function handleBookAgain(booking: DeskBooking) {
    navigate(deskBookingPath({ office: booking.office, floor: booking.floor, desk: booking.desk }));
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    const id = pendingCancel.id;
    setCancellingId(id);
    setCancelSuccess(undefined);
    setCancelError(undefined);
    try {
      await cancelMyBooking(id);
      setCancelSuccess(c.cancelSuccess);
      setPendingCancel(null);
      refresh();
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
        <Button variant="contained" onClick={() => navigate(ROUTES.bookings)}>
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
      {error && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
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
          onAction={tab === "upcoming" ? () => navigate(ROUTES.bookings) : undefined}
        />
      )}

      {!loading && current.length > 0 && (
        <MyBookingsList
          bookings={current}
          onCancel={
            tab === "upcoming"
              ? (id) => {
                  const b = current.find((x) => x.id === id);
                  if (b) setPendingCancel(b);
                }
              : undefined
          }
          onBookAgain={handleBookAgain}
          cancellingId={cancellingId}
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
