import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import type { LayoutObject } from "../types/layoutObject.types";

const c = en.app.layoutObjects;

interface Props {
  object: LayoutObject | null;
}

interface RowProps {
  label: string;
  value: string;
}

function InspectorRow({ label, value }: RowProps) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
        {value}
      </Typography>
    </Box>
  );
}

export function LayoutObjectInspector({ object }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        {c.inspectorTitle}
      </Typography>
      {object === null ? (
        <Typography variant="body2" color="text.secondary">
          {c.inspectorEmpty}
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          <InspectorRow label={c.inspectorTypeLabel} value={object.object_type_display} />
          <InspectorRow label={c.inspectorLabelField} value={object.label || c.inspectorNoLabel} />
          <Divider />
          <InspectorRow label={c.inspectorPosition} value={`(${object.x}, ${object.y})`} />
          <InspectorRow label={c.inspectorSize} value={`${object.width} × ${object.height}`} />
          <InspectorRow label={c.inspectorRotation} value={`${object.rotation}°`} />
          <Divider />
          <Box>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
            >
              {c.inspectorBookable}
            </Typography>
            <Box sx={{ mt: 0.25 }}>
              <Chip
                label={object.is_bookable ? c.inspectorYes : c.inspectorNo}
                size="small"
                color={object.is_bookable ? "success" : "default"}
                variant="outlined"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            </Box>
          </Box>
          {Object.keys(object.metadata).length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
                >
                  {c.inspectorMetadata}
                </Typography>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    display: "block",
                    mt: 0.25,
                    p: 1,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    overflow: "auto",
                    fontSize: "0.7rem",
                    fontFamily: "monospace",
                  }}
                >
                  {JSON.stringify(object.metadata, null, 2)}
                </Typography>
              </Box>
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
}
