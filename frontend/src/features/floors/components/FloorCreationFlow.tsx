import { Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { en } from "@/i18n/en";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useFloorCreationForm } from "../hooks/useFloorCreationForm";
import { FLOOR_CREATION_STEPS } from "../types/floor.types";
import type { FloorCreationStep, Floor } from "../types/floor.types";
import { FloorDetailsStep } from "./steps/FloorDetailsStep";
import { FloorReviewStep } from "./steps/FloorReviewStep";

const c = en.app.floors;

const STEP_PROGRESS: Record<FloorCreationStep, number> = {
  details: 50,
  review: 100,
};

const STEP_LABELS: Record<FloorCreationStep, string> = {
  details: c.stepDetails,
  review: c.stepReview,
};

interface Props {
  officeId: number;
  onCreated: (floor: Floor) => void;
  onCancel: () => void;
}

export function FloorCreationFlow({ officeId, onCreated, onCancel }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const {
    fields,
    setField,
    currentStep,
    isReviewStep,
    isFirstStep,
    fieldErrors,
    submission,
    goNext,
    goBack,
    handleCreate,
  } = useFloorCreationForm(officeId, onCreated);

  const numberedIndex = FLOOR_CREATION_STEPS.indexOf(currentStep);

  function renderStep(): React.ReactNode {
    switch (currentStep) {
      case "details":
        return (
          <FloorDetailsStep
            name={fields.name}
            nameError={fieldErrors.name}
            level_number={fields.level_number}
            levelError={fieldErrors.level_number}
            onChange={(field, value) => setField(field as keyof typeof fields, value)}
            disabled={submission.loading}
          />
        );
      case "review":
        return <FloorReviewStep fields={fields} />;
      default: {
        const _exhaustive: never = currentStep;
        return _exhaustive;
      }
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <LinearProgress
          variant="determinate"
          value={STEP_PROGRESS[currentStep]}
          aria-label="Floor creation progress"
          sx={{
            height: 3,
            "& .MuiLinearProgress-bar": {
              transition: reducedMotion ? "none" : "transform 0.4s ease",
            },
          }}
        />

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {numberedIndex >= 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: "block" }}>
              {STEP_LABELS[currentStep]} · {numberedIndex + 1} / {FLOOR_CREATION_STEPS.length}
            </Typography>
          )}

          {renderStep()}

          {submission.generalError && (
            <Box sx={{ mt: 3 }}>
              <ErrorAlert message={submission.generalError} />
            </Box>
          )}

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 4, justifyContent: "space-between", alignItems: "center" }}
          >
            {isFirstStep ? (
              <Button variant="text" onClick={onCancel} disabled={submission.loading}>
                {c.cancel}
              </Button>
            ) : (
              <Button variant="text" onClick={goBack} disabled={submission.loading}>
                {c.back}
              </Button>
            )}
            {isReviewStep ? (
              <LoadingButton loading={submission.loading} onClick={handleCreate} type="button">
                {c.createButton}
              </LoadingButton>
            ) : (
              <Button variant="contained" onClick={goNext} disabled={submission.loading}>
                {c.next}
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
