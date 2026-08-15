import { useState } from "react";
import { Box, Chip, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { BusinessOutlined, CheckOutlined, KeyboardArrowDownOutlined } from "@mui/icons-material";

import { en } from "@/i18n/en";
import type { Office } from "@/features/offices/types/office.types";
import { dayPartFromHour, officeLocalHour } from "../utils/todayLogic";
import * as s from "./TodayHeader.styles";

interface Props {
  firstName: string;
  offices: Office[];
  selectedOffice: Office | null;
  defaultOfficeId: number | null;
  onSelectOffice: (officeId: number) => void;
}

function greeting(office: Office | null): string {
  const part = dayPartFromHour(officeLocalHour(new Date(), office?.timezone));
  if (part === "morning") return en.app.today.greetingMorning;
  if (part === "afternoon") return en.app.today.greetingAfternoon;
  return en.app.today.greetingEvening;
}

function formatToday(office: Office | null): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  try {
    return new Intl.DateTimeFormat("en-GB", {
      ...opts,
      timeZone: office?.timezone || undefined,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts).format(new Date());
  }
}

/** Today header: time-of-day greeting, date, and the office selector chip with a
 * DEFAULT badge wired to the remembered-office pair (PR 079). */
export function TodayHeader({
  firstName,
  offices,
  selectedOffice,
  defaultOfficeId,
  onSelectOffice,
}: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const greetLine = firstName
    ? `${greeting(selectedOffice)}, ${firstName}`
    : greeting(selectedOffice);
  const isDefault = selectedOffice != null && selectedOffice.id === defaultOfficeId;
  const multi = offices.length > 1;

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{
        alignItems: { xs: "flex-start", sm: "flex-end" },
        justifyContent: "space-between",
        mb: 2.5,
      }}
    >
      <Box>
        <Typography component="h1" sx={s.greeting}>
          {greetLine}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {formatToday(selectedOffice)}
        </Typography>
      </Box>

      {selectedOffice && (
        <>
          <Chip
            onClick={multi ? (e) => setAnchor(e.currentTarget) : undefined}
            aria-haspopup={multi ? "menu" : undefined}
            aria-label={en.app.today.chooseOffice}
            icon={<BusinessOutlined color="primary" fontSize="small" />}
            deleteIcon={multi ? <KeyboardArrowDownOutlined /> : undefined}
            onDelete={multi ? (e) => setAnchor(e.currentTarget as HTMLElement) : undefined}
            label={
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Typography component="span" sx={s.officeName}>
                  {selectedOffice.name}
                </Typography>
                {isDefault && (
                  <Box component="span" sx={s.defaultBadge}>
                    {en.app.today.defaultBadge}
                  </Box>
                )}
              </Stack>
            }
            variant="outlined"
            sx={s.officeChip}
          />
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {offices.map((o) => (
              <MenuItem
                key={o.id}
                selected={o.id === selectedOffice.id}
                onClick={() => {
                  onSelectOffice(o.id);
                  setAnchor(null);
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 160 }}>
                  {o.id === selectedOffice.id ? (
                    <CheckOutlined color="primary" fontSize="small" />
                  ) : (
                    <Box sx={{ width: 16 }} />
                  )}
                  <Typography variant="body2" sx={s.menuItemName}>
                    {o.name}
                  </Typography>
                  {o.id === defaultOfficeId && (
                    <Typography variant="caption" color="text.secondary">
                      · {en.app.today.defaultBadge}
                    </Typography>
                  )}
                </Stack>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Stack>
  );
}
