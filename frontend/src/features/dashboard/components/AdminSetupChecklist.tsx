import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import { CheckCircleOutlined, RadioButtonUncheckedOutlined } from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { SetupChecklistItem } from "../utils/dashboardState";
import { en } from "@/i18n/en";

const CHECKLIST_LABELS: Record<
  string,
  { label: string; description: string; actionLabel?: string }
> = {
  profile: {
    label: en.app.dashboard.checklistItemProfileLabel,
    description: en.app.dashboard.checklistItemProfileDesc,
  },
  org: {
    label: en.app.dashboard.checklistItemOrgLabel,
    description: en.app.dashboard.checklistItemOrgDesc,
  },
  office: {
    label: en.app.dashboard.checklistItemOfficeLabel,
    description: en.app.dashboard.checklistItemOfficeDesc,
    actionLabel: en.app.dashboard.checklistItemOfficeAction,
  },
  floor: {
    label: en.app.dashboard.checklistItemFloorLabel,
    description: en.app.dashboard.checklistItemFloorDesc,
    actionLabel: en.app.dashboard.checklistItemFloorAction,
  },
  desks: {
    label: en.app.dashboard.checklistItemDesksLabel,
    description: en.app.dashboard.checklistItemDesksDesc,
    actionLabel: en.app.dashboard.checklistItemDesksAction,
  },
  invite: {
    label: en.app.dashboard.checklistItemInviteLabel,
    description: en.app.dashboard.checklistItemInviteDesc,
    actionLabel: en.app.dashboard.checklistItemInviteAction,
  },
};

interface Props {
  checklist: SetupChecklistItem[];
  loading: boolean;
}

export function AdminSetupChecklist({ checklist, loading }: Props) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {en.app.dashboard.setupTitle}
          </Typography>
          {loading && <CircularProgress size={16} aria-label="Loading setup status" />}
        </Box>

        <List disablePadding>
          {checklist.map((item) => {
            const meta = CHECKLIST_LABELS[item.id];
            if (!meta) return null;

            return (
              <ListItem
                key={item.id}
                disableGutters
                sx={{
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box
                  sx={{
                    mr: 1.5,
                    display: "flex",
                    alignItems: "center",
                    color: item.completed ? "success.main" : "text.disabled",
                  }}
                >
                  {item.completed ? (
                    <CheckCircleOutlined fontSize="small" aria-hidden="true" />
                  ) : (
                    <RadioButtonUncheckedOutlined fontSize="small" aria-hidden="true" />
                  )}
                </Box>

                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: item.completed ? "text.primary" : "text.secondary",
                        }}
                      >
                        {meta.label}
                      </Typography>
                      {item.deferred && (
                        <Chip
                          label={en.app.dashboard.checklistItemDeferred}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: "0.65rem" }}
                        />
                      )}
                      {item.completed && (
                        <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                          ✓ Done
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.disabled">
                      {meta.description}
                    </Typography>
                  }
                />

                {!item.completed && !item.deferred && item.to && meta.actionLabel && (
                  <Typography
                    component={Link}
                    to={item.to}
                    variant="caption"
                    sx={{
                      ml: 2,
                      color: "primary.main",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {meta.actionLabel} →
                  </Typography>
                )}
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
}
