import { Box, Button, Card, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { AutoAwesomeOutlined } from "@mui/icons-material";

import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import * as s from "./WelcomeCard.styles";

interface Props {
  onPickDesk: () => void;
  /** show the "connect Teams" nudge (when the account isn't linked) */
  showTeamsNudge?: boolean;
}

/** Brand-new user (no bookings ever) → a warm welcome with a single primary action into
 * Book-a-desk, plus an optional link-Teams nudge (PR 079). */
export function WelcomeCard({ onPickDesk, showTeamsNudge = true }: Props) {
  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, mb: 2.5 }}>
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Box aria-hidden sx={s.iconTile}>
          <AutoAwesomeOutlined />
        </Box>
        <Box>
          <Typography component="h2" sx={s.title}>
            {en.app.today.welcomeTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 460 }}>
            {en.app.today.welcomeBody}
          </Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        >
          <Button variant="contained" size="large" onClick={onPickDesk}>
            {en.app.today.welcomeCta}
          </Button>
          {showTeamsNudge && (
            <Button variant="outlined" size="large" component={Link} to={ROUTES.linkChat}>
              {en.app.today.linkTeamsCta}
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
