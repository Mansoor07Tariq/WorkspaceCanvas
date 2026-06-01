import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Container, Grid, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ProfileOnboardingCarousel } from "@/features/profile";
import {
  getFirstActiveMembership,
  canManageWorkspaceContent,
} from "@/features/organizations/utils/membershipUtils";
import {
  getSetupChecklist,
  getTodayBooking,
  getNextBooking,
  getSetupProgress,
} from "@/features/dashboard/utils/dashboardState";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { DashboardHero } from "@/features/dashboard/components/DashboardHero";
import { TodayBookingCard } from "@/features/dashboard/components/TodayBookingCard";
import { UpcomingBookingCard } from "@/features/dashboard/components/UpcomingBookingCard";
import { AdminSetupChecklist } from "@/features/dashboard/components/AdminSetupChecklist";
import { WorkspaceHealthCards } from "@/features/dashboard/components/WorkspaceHealthCards";
import { DashboardQuickActions } from "@/features/dashboard/components/DashboardQuickActions";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";

export function DashboardPage() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutUser();
    navigate(ROUTES.login);
  }

  return (
    <AppShell onLogout={() => void handleLogout()}>
      {user && !user.is_profile_completed ? (
        <ProfileOnboardingCarousel />
      ) : (
        <DashboardContent user={user} />
      )}
    </AppShell>
  );
}

interface DashboardContentProps {
  user: CurrentUser | null;
}

function DashboardContent({ user }: DashboardContentProps) {
  const membership = getFirstActiveMembership(user);
  const hasOrg = !!membership;
  const isOwnerOrAdmin = canManageWorkspaceContent(membership?.role);
  const firstName = user?.first_name || user?.full_name?.split(" ")[0] || "";

  const {
    offices,
    officesLoading,
    officesError,
    floors,
    floorsLoading,
    floorsError,
    desks,
    desksLoading,
    bookings,
    bookingsLoading,
    bookingsError,
    today,
    firstOffice,
    firstFloor,
  } = useDashboardData();

  if (!hasOrg) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {en.app.dashboard.noOrgTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {en.app.dashboard.noOrgMessage}
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={Link}
            to={ROUTES.offices}
            aria-label={en.app.dashboard.createOrgAction}
          >
            {en.app.dashboard.createOrgAction}
          </Button>
        </Box>
      </Container>
    );
  }

  const checklist = getSetupChecklist({ user, hasOrg, offices, floors, desks });
  const setupProgress = getSetupProgress(checklist);
  const todayBooking = getTodayBooking(bookings, today);
  const nextBooking = getNextBooking(bookings, today);
  const dataLoading = officesLoading || floorsLoading || desksLoading;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      <Box>
        <DashboardHero
          firstName={firstName}
          isOwnerOrAdmin={isOwnerOrAdmin}
          hasOrg={hasOrg}
          orgName={membership?.organization_name ?? null}
          setupProgress={setupProgress}
        />

        {floorsError && (
          <Alert severity="warning" role="alert" sx={{ mb: 2 }}>
            {floorsError}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: nextBooking ? 6 : 12 }}>
            <TodayBookingCard
              booking={todayBooking}
              loading={bookingsLoading}
              error={bookingsError}
            />
          </Grid>
          {nextBooking && (
            <Grid size={{ xs: 12, md: 6 }}>
              <UpcomingBookingCard booking={nextBooking} />
            </Grid>
          )}
        </Grid>

        <DashboardQuickActions
          isOwnerOrAdmin={isOwnerOrAdmin}
          firstOffice={firstOffice}
          firstFloor={firstFloor}
        />

        {isOwnerOrAdmin && (
          <>
            <AdminSetupChecklist checklist={checklist} loading={dataLoading} />
            <WorkspaceHealthCards
              officesCount={offices.length}
              floorsCount={floors.length}
              desksCount={desks.length}
              loading={dataLoading}
              error={officesError}
            />
          </>
        )}
      </Box>
    </Container>
  );
}
