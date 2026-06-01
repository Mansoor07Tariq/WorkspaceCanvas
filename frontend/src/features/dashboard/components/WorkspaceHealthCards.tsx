import { Alert, Box, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";
import { BusinessOutlined, LayersOutlined, WeekendOutlined } from "@mui/icons-material";
import type { ReactNode } from "react";
import { en } from "@/i18n/en";

interface HealthCardProps {
  label: string;
  count: number;
  icon: ReactNode;
  loading: boolean;
}

function HealthCard({ label, count, icon, loading }: HealthCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: "primary.50",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={32} height={28} />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {count}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

interface Props {
  officesCount: number;
  floorsCount: number;
  desksCount: number;
  loading: boolean;
  error: string | null;
}

export function WorkspaceHealthCards({
  officesCount,
  floorsCount,
  desksCount,
  loading,
  error,
}: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
        {en.app.dashboard.healthTitle}
      </Typography>
      {error && (
        <Alert severity="warning" role="alert" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <HealthCard
            label={en.app.dashboard.healthOffices}
            count={officesCount}
            icon={<BusinessOutlined fontSize="small" />}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <HealthCard
            label={en.app.dashboard.healthFloors}
            count={floorsCount}
            icon={<LayersOutlined fontSize="small" />}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <HealthCard
            label={en.app.dashboard.healthDesks}
            count={desksCount}
            icon={<WeekendOutlined fontSize="small" />}
            loading={loading}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
