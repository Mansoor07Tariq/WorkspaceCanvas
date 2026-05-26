import { Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { en } from "@/i18n/en";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useOrgSetupForm } from "../hooks/useOrgSetupForm";
import { ORG_SETUP_STEPS } from "../types/organization.types";
import type { OrgSetupStep } from "../types/organization.types";
import { OrgStepWelcome } from "./steps/OrgStepWelcome";
import { OrgStepName } from "./steps/OrgStepName";
import { OrgStepType } from "./steps/OrgStepType";
import { OrgStepDomain } from "./steps/OrgStepDomain";
import { OrgStepReview } from "./steps/OrgStepReview";

const c = en.app.orgSetup;

const STEP_PROGRESS: Record<OrgSetupStep, number> = {
  welcome: 10,
  name: 35,
  type: 58,
  domain: 78,
  review: 100,
};

const STEP_LABELS: Record<OrgSetupStep, string> = {
  welcome: c.stepWelcome,
  name: c.stepName,
  type: c.stepType,
  domain: c.stepDomain,
  review: c.stepReview,
};

// Exclude "welcome" from the numbered steps. Explicit type prevents TS 5.5+
// narrowing the array to ("name"|"type"|"domain"|"review")[], which would make
// indexOf(currentStep) reject OrgSetupStep at compile time.
const NUMBERED_STEPS: OrgSetupStep[] = ORG_SETUP_STEPS.filter((s) => s !== "welcome");

interface Props {
  onCreated: () => void;
}

export function OrganizationSetupFlow({ onCreated }: Props) {
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
    goSkip,
    goBack,
    handleCreate,
  } = useOrgSetupForm(onCreated);

  const isWelcome = currentStep === "welcome";
  const numberedIndex = NUMBERED_STEPS.indexOf(currentStep);

  function renderStep(): React.ReactNode {
    switch (currentStep) {
      case "welcome":
        return <OrgStepWelcome onStart={goNext} />;
      case "name":
        return (
          <OrgStepName
            name={fields.name}
            onChange={(v) => setField("name", v)}
            error={fieldErrors.name}
            disabled={submission.loading}
          />
        );
      case "type":
        return (
          <OrgStepType
            value={fields.organization_type}
            onChange={(v) => setField("organization_type", v)}
            disabled={submission.loading}
          />
        );
      case "domain":
        return (
          <OrgStepDomain
            allowedDomain={fields.allowed_email_domain}
            onChange={(v) => setField("allowed_email_domain", v)}
            error={fieldErrors.allowed_email_domain}
            disabled={submission.loading}
          />
        );
      case "review":
        return (
          <OrgStepReview
            name={fields.name}
            organizationType={fields.organization_type}
            allowedDomain={fields.allowed_email_domain}
          />
        );
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
        {/* Progress bar */}
        {!isWelcome && (
          <LinearProgress
            variant="determinate"
            value={STEP_PROGRESS[currentStep]}
            aria-label="Organization setup progress"
            sx={{
              height: 3,
              "& .MuiLinearProgress-bar": {
                transition: reducedMotion ? "none" : "transform 0.4s ease",
              },
            }}
          />
        )}

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Step counter */}
          {!isWelcome && numberedIndex >= 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: "block" }}>
              {STEP_LABELS[currentStep]} · {numberedIndex + 1} / {NUMBERED_STEPS.length}
            </Typography>
          )}

          {renderStep()}

          {/* General error */}
          {submission.generalError && (
            <Box sx={{ mt: 3 }}>
              <ErrorAlert message={submission.generalError} />
            </Box>
          )}

          {/* Navigation */}
          {!isWelcome && (
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
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                {currentStep === "domain" && (
                  <Button variant="text" onClick={goSkip} disabled={submission.loading}>
                    {c.skip}
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
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
