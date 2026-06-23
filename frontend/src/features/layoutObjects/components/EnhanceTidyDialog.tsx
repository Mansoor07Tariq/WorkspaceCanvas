/**
 * EnhanceTidyDialog — preview + result UI for the explicit Tidy action.
 *
 * Preview: shows how many objects will change, warnings, and Cancel/Apply.
 * Result: shows success / partial-success / failure with per-operation details,
 * plus Undo (when changes were applied) and Retry (when operations failed).
 */
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import type { UseEnhanceTidyResult } from "../hooks/useEnhanceTidy";

const c = en.app.layoutObjects;

const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

function ResultDetails({ tidy }: { tidy: UseEnhanceTidyResult }) {
  const issues = (tidy.result?.operation_results ?? []).filter((r) => r.status !== "applied");
  if (issues.length === 0) return null;
  const hasStale = issues.some((r) => r.error_code === "stale_geometry");
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2">{c.tidyResultDetails}</Typography>
      <List dense aria-label={c.tidyResultDetails}>
        {issues.map((r) => (
          <ListItem key={`${r.object_id}-${r.status}`} disableGutters>
            <ListItemText
              primary={`#${r.object_id} — ${r.status}`}
              secondary={r.error_message ?? r.error_code ?? undefined}
            />
          </ListItem>
        ))}
      </List>
      {hasStale && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {c.tidyStaleHint}
        </Alert>
      )}
    </Box>
  );
}

export function EnhanceTidyDialog({ tidy }: { tidy: UseEnhanceTidyResult }) {
  const open = tidy.phase !== "idle";
  if (!open) return null;

  const isPreview = tidy.phase === "preview";
  const plan = tidy.plan;
  const result = tidy.result;

  const resultTitle =
    result?.status === "success"
      ? c.tidyResultSuccess
      : result?.status === "partial_success"
        ? c.tidyResultPartial
        : c.tidyResultFailed;

  const changed = plan?.operations.length ?? 0;
  const isClean = isPreview && changed === 0;

  return (
    <Dialog
      open
      onClose={tidy.busy ? undefined : tidy.close}
      maxWidth="sm"
      fullWidth
      aria-labelledby="enhance-tidy-title"
    >
      <DialogTitle id="enhance-tidy-title">
        {isPreview ? (isClean ? c.tidyDialogTitle : c.tidySuggestTitle) : resultTitle}
      </DialogTitle>
      <DialogContent>
        {tidy.error && (
          <Alert severity="error" role="alert" sx={{ mb: 2 }}>
            {c.tidyError}
          </Alert>
        )}

        {isPreview && plan && (
          <>
            {isClean ? (
              <DialogContentText>{c.tidyPreviewClean}</DialogContentText>
            ) : (
              <>
                <DialogContentText>{c.tidySuggestIntro}</DialogContentText>
                <List dense aria-label={c.tidySuggestTitle}>
                  {tidy.suggestions.map((s) => {
                    const checked = tidy.selectedSuggestionIds.has(s.id);
                    return (
                      <ListItem key={s.id} disableGutters alignItems="flex-start">
                        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                          <Checkbox
                            edge="start"
                            size="small"
                            checked={checked}
                            disabled={tidy.busy}
                            onChange={() => tidy.toggleSuggestion(s.id)}
                            slotProps={{
                              input: {
                                "aria-label": `${c.tidySuggestSelectLabel}: ${s.title}`,
                              },
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText primary={s.title} secondary={s.description} />
                      </ListItem>
                    );
                  })}
                </List>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1 }}
                >
                  {fmt(c.tidySelectedSummary, {
                    selected: tidy.selectedSuggestionIds.size,
                    total: tidy.suggestions.length,
                    objects: tidy.selectedObjectCount,
                  })}{" "}
                  · {fmt(c.tidyPreviewUnchanged, { count: plan.summary.unchanged })}
                </Typography>
              </>
            )}
            {plan.diagnostics.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Alert severity="info">{c.tidySuggestManual}</Alert>
                <List dense>
                  {plan.diagnostics.map((d) => (
                    <ListItem key={d.code} disableGutters>
                      <ListItemText primary={d.message} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </>
        )}

        {!isPreview && result && (
          <>
            <DialogContentText>
              {fmt(c.tidyResultSummary, {
                applied: result.applied_count,
                failed: result.failed_count,
                skipped: result.skipped_count,
              })}
            </DialogContentText>
            {tidy.lastAction === "undo" && (
              <Alert severity="success" sx={{ mt: 1 }}>
                {c.tidyUndoDone}
              </Alert>
            )}
            {tidy.lastAction === "retry" && (
              <Alert severity="info" sx={{ mt: 1 }}>
                {c.tidyRetryDone}
              </Alert>
            )}
            <ResultDetails tidy={tidy} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {isPreview ? (
          <>
            <Button onClick={tidy.cancel} disabled={tidy.busy} color="inherit">
              {c.tidyCancel}
            </Button>
            <Button
              onClick={() => void tidy.apply()}
              disabled={tidy.busy || !tidy.canApply}
              variant="contained"
              startIcon={tidy.busy ? <CircularProgress size={16} /> : undefined}
            >
              {tidy.busy ? c.tidyApplying : c.tidyApplySelected}
            </Button>
          </>
        ) : (
          <>
            {tidy.canRetry && (
              <Button onClick={() => void tidy.retry()} disabled={tidy.busy} color="warning">
                {c.tidyRetry}
              </Button>
            )}
            {tidy.canUndo && (
              <Button onClick={() => void tidy.undo()} disabled={tidy.busy} color="inherit">
                {c.tidyUndo}
              </Button>
            )}
            <Button onClick={tidy.close} disabled={tidy.busy} variant="contained">
              {c.tidyClose}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
