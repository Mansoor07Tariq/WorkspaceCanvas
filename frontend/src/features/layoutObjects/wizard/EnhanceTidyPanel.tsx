/**
 * EnhanceTidyPanel — the Tidy step's left-rail panel (PR 064).
 *
 * Same flow and state as EnhanceTidyDialog (preview → apply → undo/retry) but
 * laid out as a side panel beside the canvas, with the suggestion checkboxes
 * inline. Reuses the `useEnhanceTidy` result verbatim — no new logic.
 */
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { AutoAwesomeMosaicOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { UseEnhanceTidyResult } from "../hooks/useEnhanceTidy";

const c = en.app.layoutObjects;

const fmt = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

export function EnhanceTidyPanel({ tidy }: { tidy: UseEnhanceTidyResult }) {
  return (
    <Box data-testid="enhance-tidy-panel" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <AutoAwesomeMosaicOutlined fontSize="small" color="primary" />
        <Typography variant="subtitle1">{c.tidyDialogTitle}</Typography>
      </Stack>

      {tidy.error && (
        <Alert severity="error" role="alert" sx={{ mb: 1.5 }}>
          {c.tidyError}
        </Alert>
      )}

      {tidy.phase === "result" && tidy.result ? (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {fmt(c.tidyResultSummary, {
              applied: tidy.result.applied_count,
              failed: tidy.result.failed_count,
              skipped: tidy.result.skipped_count,
            })}
          </Typography>
          {tidy.lastAction === "undo" && (
            <Alert severity="success" sx={{ mb: 1 }}>
              {c.tidyUndoDone}
            </Alert>
          )}
          {tidy.result.operation_results.filter((r) => r.status !== "applied").length > 0 && (
            <List dense aria-label={c.tidyResultDetails}>
              {tidy.result.operation_results
                .filter((r) => r.status !== "applied")
                .map((r) => (
                  <ListItem key={`${r.object_id}-${r.status}`} disableGutters>
                    <ListItemText
                      primary={`#${r.object_id} — ${r.status}`}
                      secondary={r.error_message ?? r.error_code ?? undefined}
                    />
                  </ListItem>
                ))}
            </List>
          )}
          <Stack spacing={1} sx={{ mt: 1 }}>
            {tidy.canRetry && (
              <Button
                size="small"
                color="warning"
                onClick={() => void tidy.retry()}
                disabled={tidy.busy}
              >
                {c.tidyRetry}
              </Button>
            )}
            {tidy.canUndo && (
              <Button size="small" onClick={() => void tidy.undo()} disabled={tidy.busy}>
                {c.tidyUndo}
              </Button>
            )}
            <Button size="small" variant="outlined" onClick={tidy.openPreview} disabled={tidy.busy}>
              {c.tidyDialogTitle}
            </Button>
          </Stack>
        </>
      ) : tidy.phase === "preview" && tidy.plan ? (
        tidy.suggestions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {c.tidyPreviewClean}
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {c.tidySuggestIntro}
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={0.5}>
              {tidy.suggestions.map((s) => (
                <FormControlLabel
                  key={s.id}
                  sx={{ alignItems: "flex-start", m: 0, py: 0.5 }}
                  control={
                    <Checkbox
                      size="small"
                      sx={{ pt: 0 }}
                      checked={tidy.selectedSuggestionIds.has(s.id)}
                      disabled={tidy.busy}
                      onChange={() => tidy.toggleSuggestion(s.id)}
                      slotProps={{
                        input: { "aria-label": `${c.tidySuggestSelectLabel}: ${s.title}` },
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{s.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              {fmt(c.tidySelectedSummary, {
                selected: tidy.selectedSuggestionIds.size,
                total: tidy.suggestions.length,
                objects: tidy.selectedObjectCount,
              })}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              size="small"
              sx={{ mt: 1.5 }}
              disabled={tidy.busy || !tidy.canApply}
              startIcon={tidy.busy ? <CircularProgress size={16} /> : undefined}
              onClick={() => void tidy.apply()}
            >
              {tidy.busy ? c.tidyApplying : c.tidyApplySelected}
            </Button>
          </>
        )
      ) : (
        <Button
          variant="outlined"
          size="small"
          onClick={tidy.openPreview}
          startIcon={<AutoAwesomeMosaicOutlined />}
        >
          {c.tidyButton}
        </Button>
      )}
    </Box>
  );
}
