import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Container, Skeleton, Stack, Typography } from "@mui/material";
import { ArrowOutwardOutlined } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import { en } from "@/i18n/en";
import { deskBookingPath } from "@/routes/paths";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { canManageWorkspaceContent } from "@/features/organizations/utils/membershipUtils";
import { FloorOverviewMap } from "./FloorOverviewMap";
import { useTodayData } from "../hooks/useTodayData";
import {
  interpolate,
  officeLocalHour,
  rankNearest,
  resolveOrigin,
  shouldEmphasizeTomorrow,
  toISODate,
} from "../utils/todayLogic";
import { TodayHeader } from "./TodayHeader";
import { WeekStrip } from "./WeekStrip";
import { NearYouPanel } from "./NearYouPanel";
import { AdminSetupBanner } from "./AdminSetupBanner";
import { WelcomeCard } from "./WelcomeCard";
import { FloorPills } from "./FloorPills";
import * as s from "./TodayContent.styles";

/** The Today home content (PR 079) — assumes a profile-complete user with an org (the
 * gates live in TodayPage). Composes the header, the map hero + near-you, and the week
 * strip, plus the brand-new/admin/partial-failure states. */
export function TodayContent() {
  const { user } = useAuth();
  const { selectedMembership } = useSelectedOrganization();
  const data = useTodayData();
  const navigate = useNavigate();
  const [highlightedDeskId, setHighlightedDeskId] = useState<number | null>(null);

  const firstName = user?.first_name || user?.full_name?.split(" ")[0] || "";
  const isAdmin = canManageWorkspaceContent(selectedMembership?.role);
  const { summary } = useWorkspaceSummary(data.orgId);
  const workspaceIncomplete =
    summary != null && !(summary.has_offices && summary.has_floors && summary.has_bookable_desks);

  const selectedDay = data.days[data.selectedDayIndex]?.day ?? data.week[0];
  const myBookingToday = data.days[data.selectedDayIndex]?.myBooking ?? null;

  // "Near you" ranking (≤3), origin = my desk → usual desk → map centre.
  const nearby = useMemo(() => {
    const origin = resolveOrigin(data.myOccupant, data.usualDeskPoint, data.occupants);
    return rankNearest(data.occupants, origin, 3);
  }, [data.myOccupant, data.usualDeskPoint, data.occupants]);
  const totalOthers = data.occupants.filter((o) => !o.isMine).length;

  // Occupant (name + colour) per desk for the map's initial chips — others only.
  const occupantByDeskId = useMemo(
    () =>
      new Map(
        data.occupants
          .filter((o) => !o.isMine)
          .map((o) => [o.deskId, { name: o.userName, colorKey: o.userId ?? o.userName }])
      ),
    [data.occupants]
  );

  const goBook = (deskId?: number) =>
    navigate(
      deskBookingPath({
        office: data.selectedOffice?.id,
        floor: data.selectedFloor?.id,
        desk: deskId,
        date: selectedDay?.iso,
      })
    );
  const goFullFloor = () =>
    navigate(
      deskBookingPath({
        office: data.selectedOffice?.id,
        floor: data.selectedFloor?.id,
        date: selectedDay?.iso,
      })
    );

  const bookTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    navigate(
      deskBookingPath({
        office: data.selectedOffice?.id,
        floor: data.selectedFloor?.id,
        date: toISODate(tomorrow),
      })
    );
  };

  // After 14:00 office-local, an un-booked Today flips its emphasis to "plan tomorrow"
  // (the office day is mostly gone). Only when today is the selected column.
  const emphasizeTomorrow =
    (data.days[data.selectedDayIndex]?.day?.isToday ?? false) &&
    myBookingToday == null &&
    shouldEmphasizeTomorrow(officeLocalHour(new Date(), data.selectedOffice?.timezone));

  // Brand-new user: confirmed never-booked (resolve_usual_desk returned null WITHOUT
  // error) and nothing booked this week. A FAILED usual-desk fetch (e.g. a throttled 429)
  // must NOT be read as "brand new" — otherwise a returning user sees the welcome card;
  // fall back to the normal Today instead.
  const brandNew =
    !data.loading.offices &&
    !data.loading.week &&
    !data.errors.usualDesk &&
    data.usualDesk == null &&
    data.days.every((d) => d.myBooking == null && d.others.length === 0) &&
    data.offices.length > 0;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, pb: { xs: 10, sm: 6 } }}>
      {isAdmin && workspaceIncomplete && data.orgId != null && (
        <AdminSetupBanner orgId={data.orgId} />
      )}

      <TodayHeader
        firstName={firstName}
        offices={data.offices}
        selectedOffice={data.selectedOffice}
        defaultOfficeId={data.defaultOfficeId}
        onSelectOffice={data.selectOffice}
      />

      {!brandNew && emphasizeTomorrow && (
        <Alert
          severity="info"
          icon={false}
          sx={s.planAlert}
          action={
            <Button size="small" variant="contained" onClick={bookTomorrow}>
              {en.app.today.planTomorrowCta}
            </Button>
          }
        >
          <Typography sx={s.planTitle}>{en.app.today.planTomorrowTitle}</Typography>
          <Typography variant="body2">{interpolate(en.app.today.planTomorrowBody, {})}</Typography>
        </Alert>
      )}

      {brandNew ? (
        <WelcomeCard onPickDesk={() => goBook()} />
      ) : (
        <>
          {/* Map hero */}
          <Card sx={{ overflow: "hidden", p: 0 }}>
            <Stack direction="row" spacing={1} sx={s.heroHeaderRow}>
              <FloorPills
                floors={data.floors}
                selectedFloorId={data.selectedFloor?.id ?? null}
                onSelectFloor={data.selectFloor}
                loading={data.loading.floors}
              />
              <Box sx={{ flexGrow: 1 }} />
              <Button
                onClick={goFullFloor}
                variant="text"
                endIcon={<ArrowOutwardOutlined fontSize="small" />}
                sx={s.viewFloorButton}
              >
                {en.app.today.viewFullFloor}
              </Button>
            </Stack>

            <Box sx={s.heroGrid}>
              <Box sx={s.mapViewport}>
                {data.errors.map ? (
                  <Alert severity="warning" sx={{ m: 1 }}>
                    {en.app.today.mapUnavailable}
                  </Alert>
                ) : data.loading.map || data.floors.length === 0 ? (
                  data.floors.length === 0 && !data.loading.floors ? (
                    <Typography sx={s.noFloors}>{en.app.today.noFloors}</Typography>
                  ) : (
                    <Skeleton variant="rounded" sx={s.mapSkeleton} />
                  )
                ) : (
                  <FloorOverviewMap
                    items={data.availability.items}
                    layoutObjects={data.layoutObjects}
                    boundary={data.boundary}
                    usualDeskLayoutObjectId={data.usualDesk?.layout_object ?? null}
                    occupantByDeskId={occupantByDeskId}
                    highlightedDeskId={highlightedDeskId}
                    onDeskSelect={(deskId) => goBook(deskId)}
                    onBackgroundClick={() => goBook()}
                  />
                )}
              </Box>

              <Box sx={s.nearYouColumn}>
                {data.errors.usualDesk ? (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    {en.app.today.occupancyUnavailable}
                  </Alert>
                ) : null}
                <NearYouPanel
                  dayLabel={selectedDay?.dayLabel ?? ""}
                  nearby={nearby}
                  totalOthers={totalOthers}
                  freeCount={data.availability.counts.available}
                  myDeskCode={myBookingToday?.desk_code || myBookingToday?.desk_name || null}
                  highlightedDeskId={highlightedDeskId}
                  onHighlight={setHighlightedDeskId}
                  onBook={() => goBook()}
                  onViewFullFloor={goFullFloor}
                />
              </Box>
            </Box>
          </Card>

          <WeekStrip
            days={data.days}
            selectedIndex={data.selectedDayIndex}
            onSelectDay={data.selectDay}
          />
        </>
      )}
    </Container>
  );
}
