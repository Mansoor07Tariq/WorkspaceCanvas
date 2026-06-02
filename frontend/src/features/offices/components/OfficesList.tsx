import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { Office } from "../types/office.types";
import { OfficeCard } from "./OfficeCard";

const c = en.app.offices;

interface Props {
  offices: Office[];
  canManage?: boolean;
  onAddOffice: () => void;
}

export function OfficesList({ offices, canManage = true, onAddOffice }: Props) {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
          {c.listTitle}
        </Typography>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={onAddOffice}
            size="small"
          >
            {c.addOffice}
          </Button>
        )}
      </Stack>
      <Grid container spacing={2}>
        {offices.map((office) => (
          <Grid key={office.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <OfficeCard office={office} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
