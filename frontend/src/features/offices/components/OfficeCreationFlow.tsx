import { Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { en } from "@/i18n/en";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useOfficeCreationForm } from "../hooks/useOfficeCreationForm";
import { OFFICE_CREATION_STEPS } from "../types/office.types";
import type { OfficeCreationStep } from "../types/office.types";
import type { Office } from "../types/office.types";
import { OfficeWelcomeStep } from "./steps/OfficeWelcomeStep";
import { OfficeNameStep } from "./steps/OfficeNameStep";
import { OfficeLocationStep } from "./steps/OfficeLocationStep";
import { OfficeReviewStep } from "./steps/OfficeReviewStep";

const c = en.app.offices;

const STEP_PROGRESS: Record<OfficeCreationStep, number> = {
  welcome: 10,
  name: 40,
  location: 70,
  review: 100,
};

const STEP_LABELS: Record<OfficeCreationStep, string> = {
  welcome: c.stepWelcome,
  name: c.stepName,
  location: c.stepLocation,
  review: c.stepReview,
};

const NUMBERED_STEPS: OfficeCreationStep[] = OFFICE_CREATION_STEPS.filter((s) => s !== "welcome");

interface Props {
  onCreated: (office: Office) => void;
  /** Selected org to create the office in (PR 055 multi-org); defaults to first active. */
  orgId?: number | null;
}

export function OfficeCreationFlow({ onCreated, orgId }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const {
    fields,
    setField,
    currentStep,
    isWelcomeStep,
    isReviewStep,
    fieldErrors,
    submission,
    goNext,
    goBack,
    handleCreate,
  } = useOfficeCreationForm(onCreated, orgId);

  const numberedIndex = NUMBERED_STEPS.indexOf(currentStep);

  function renderStep(): React.ReactNode {
    switch (currentStep) {
      case "welcome":
        return <OfficeWelcomeStep onStart={goNext} />;
      case "name":
        return (
          <OfficeNameStep
            name={fields.name}
            onChange={(v) => setField("name", v)}
            error={fieldErrors.name}
            disabled={submission.loading}
          />
        );
      case "location":
        return (
          <OfficeLocationStep
            address_line_1={fields.address_line_1}
            address_line_2={fields.address_line_2}
            city={fields.city}
            county_or_state={fields.county_or_state}
            country={fields.country}
            timezone={fields.timezone}
            timezoneError={fieldErrors.timezone}
            onChange={(field, value) => setField(field as keyof typeof fields, value)}
            disabled={submission.loading}
          />
        );
      case "review":
        return <OfficeReviewStep fields={fields} />;
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
        {!isWelcomeStep && (
          <LinearProgress
            variant="determinate"
            value={STEP_PROGRESS[currentStep]}
            aria-label="Office creation progress"
            sx={{
              height: 3,
              "& .MuiLinearProgress-bar": {
                transition: reducedMotion ? "none" : "transform 0.4s ease",
              },
            }}
          />
        )}

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {!isWelcomeStep && numberedIndex >= 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: "block" }}>
              {STEP_LABELS[currentStep]} · {numberedIndex + 1} / {NUMBERED_STEPS.length}
            </Typography>
          )}

          {renderStep()}

          {submission.generalError && (
            <Box sx={{ mt: 3 }}>
              <ErrorAlert message={submission.generalError} />
            </Box>
          )}

          {!isWelcomeStep && (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ mt: 4, justifyContent: "space-between", alignItems: "center" }}
            >
              <Button
                variant="text"
                onClick={goBack}
                disabled={isWelcomeStep || submission.loading}
              >
                {c.back}
              </Button>
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
          )}
        </Box>
      </Paper>
    </Box>
  );
}
