/**
 * FloorSetupStepper — the top progress bar for the floor setup wizard.
 *
 * Responsive: a full clickable horizontal stepper on >= sm screens; a compact
 * "Step X of Y · Label" with Back/Next on xs. Steps are freely navigable.
 */
import {
  Box,
  Button,
  IconButton,
  Step,
  StepButton,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { en } from "@/i18n/en";
import { FLOOR_SETUP_STEPS, type FloorSetupStepId } from "./steps";

const w = en.app.layoutObjects.wizard;

const STEP_LABEL: Record<FloorSetupStepId, string> = {
  build: w.build,
  openings: w.openings,
  tidy: w.tidy,
  review: w.review,
};
const STEP_DESC: Record<FloorSetupStepId, string> = {
  build: w.buildDesc,
  openings: w.openingsDesc,
  tidy: w.tidyDesc,
  review: w.reviewDesc,
};

const fmt = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

interface Props {
  activeId: FloorSetupStepId;
  onStep: (id: FloorSetupStepId) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function FloorSetupStepper({ activeId, onStep, onNext, onPrev }: Props) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"));
  const index = FLOOR_SETUP_STEPS.indexOf(activeId);

  if (compact) {
    return (
      <Box
        data-testid="floor-setup-stepper"
        sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5 }}
      >
        <IconButton size="small" aria-label={w.back} disabled={index <= 0} onClick={onPrev}>
          <ChevronLeft />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {fmt(w.stepOf, { current: index + 1, total: FLOOR_SETUP_STEPS.length })}
          </Typography>
          <Typography variant="subtitle2" noWrap>
            {STEP_LABEL[activeId]}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={w.nextStep}
          disabled={index >= FLOOR_SETUP_STEPS.length - 1}
          onClick={onNext}
        >
          <ChevronRight />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      data-testid="floor-setup-stepper"
      sx={{ overflowX: "auto", px: 1, py: 1 }}
      role="navigation"
      aria-label={w.guidedSetup}
    >
      <Stepper nonLinear activeStep={index} alternativeLabel sx={{ minWidth: 480 }}>
        {FLOOR_SETUP_STEPS.map((id) => (
          <Step key={id} completed={false}>
            <StepButton
              onClick={() => onStep(id)}
              optional={
                <Typography variant="caption" color="text.secondary">
                  {STEP_DESC[id]}
                </Typography>
              }
            >
              {STEP_LABEL[id]}
            </StepButton>
          </Step>
        ))}
      </Stepper>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Button size="small" startIcon={<ChevronLeft />} disabled={index <= 0} onClick={onPrev}>
          {w.back}
        </Button>
        <Button
          size="small"
          endIcon={<ChevronRight />}
          disabled={index >= FLOOR_SETUP_STEPS.length - 1}
          onClick={onNext}
        >
          {w.nextStep}
        </Button>
      </Box>
    </Box>
  );
}
