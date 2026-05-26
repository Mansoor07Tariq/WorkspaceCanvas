import { Box, Button, Paper, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { en } from "@/i18n/en";
import { useAuth } from "@/features/auth/context/AuthContext";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useProfileOnboardingForm } from "../hooks/useProfileOnboardingForm";
import { ONBOARDING_STEPS } from "../types/profile.types";
import type { OnboardingStep } from "../types/profile.types";
import {
  stepIn,
  brandGradient,
  brandGradientHover,
  carouselOuterSx,
  carouselContentSx,
  carouselPaperSx,
  carouselNavRowSx,
  carouselSkipButtonSx,
  carouselNextButtonSx,
} from "../styles/profile.styles";
import { ProfileOnboardingBackground } from "./onboarding/ProfileOnboardingBackground";
import { ProfileOnboardingProgress } from "./onboarding/ProfileOnboardingProgress";
import { ProfileCompletionProgressBar } from "./onboarding/ProfileCompletionProgressBar";
import { StepWelcome } from "./carousel/StepWelcome";
import { StepName } from "./carousel/StepName";
import { StepEmail } from "./carousel/StepEmail";
import { StepWorkDetails } from "./carousel/StepWorkDetails";
import { StepAvatar } from "./carousel/StepAvatar";
import { StepDone } from "./carousel/StepDone";

const OPTIONAL_STEPS = new Set<OnboardingStep>(["workDetails", "avatar"]);

export function ProfileOnboardingCarousel() {
  const { user } = useAuth();
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();

  const {
    fields,
    setField,
    stepIndex,
    currentStep,
    isLastStep,
    fieldErrors,
    avatarFile,
    avatarPreview,
    avatarError,
    submission,
    selectAvatarFile,
    clearAvatarFile,
    goNext,
    goBack,
    handleFinish,
  } = useProfileOnboardingForm();

  const c = en.app.profile.carousel;
  const isDone = currentStep === "done";
  const isWelcome = currentStep === "welcome";
  const isOptional = OPTIONAL_STEPS.has(currentStep);

  function renderStep(): React.ReactNode {
    switch (currentStep) {
      case "welcome":
        return <StepWelcome onStart={goNext} />;
      case "name":
        return (
          <StepName
            fullName={fields.fullName}
            onChange={(v) => setField("fullName", v)}
            error={fieldErrors.fullName}
            disabled={submission.loading}
          />
        );
      case "email":
        return (
          <StepEmail email={user?.email ?? ""} emailVerified={user?.email_verified ?? false} />
        );
      case "workDetails":
        return (
          <StepWorkDetails
            jobTitle={fields.jobTitle}
            phoneNumber={fields.phoneNumber}
            timezone={fields.timezone}
            phoneError={fieldErrors.phoneNumber}
            onJobTitleChange={(v) => setField("jobTitle", v)}
            onPhoneChange={(v) => setField("phoneNumber", v)}
            onTimezoneChange={(v) => setField("timezone", v)}
            disabled={submission.loading}
          />
        );
      case "avatar":
        return (
          <StepAvatar
            fullName={fields.fullName}
            avatarPreview={avatarPreview}
            avatarError={avatarError}
            onSelect={selectAvatarFile}
            onClear={clearAvatarFile}
            disabled={submission.loading}
          />
        );
      case "done":
        return (
          <StepDone
            fullName={fields.fullName}
            email={user?.email ?? ""}
            timezone={fields.timezone}
            avatarPreview={avatarFile ? avatarPreview : null}
            avatarUrl={user?.avatar ?? null}
          />
        );
      default: {
        const _exhaustive: never = currentStep;
        return _exhaustive;
      }
    }
  }

  // MUI AppBar is 64px on desktop; fill the remaining viewport height.
  return (
    <Box sx={carouselOuterSx}>
      {/* Decorative background layer */}
      <ProfileOnboardingBackground />

      {/* All content above background */}
      <Box sx={carouselContentSx}>
        {/* Step progress — visible on all steps */}
        <ProfileOnboardingProgress stepIndex={stepIndex} />

        {/* Glassmorphism content panel */}
        <Paper
          elevation={0}
          sx={{
            ...carouselPaperSx,
            borderColor: alpha(theme.palette.primary.main, 0.1),
          }}
        >
          <Stack spacing={3} sx={{ flexGrow: 1 }}>
            <ErrorAlert message={submission.generalError} />

            {/* Animated step content — flexGrow fills the panel so all slides share the same height */}
            <Box
              key={currentStep}
              sx={
                reducedMotion
                  ? { flexGrow: 1 }
                  : { flexGrow: 1, animation: `${stepIn} 0.3s ease-out both` }
              }
            >
              {renderStep()}
            </Box>

            {/* Navigation — hidden on welcome and done */}
            {!isWelcome && !isDone && (
              <Stack direction="row" spacing={1.5} sx={carouselNavRowSx}>
                <Button
                  variant="outlined"
                  onClick={goBack}
                  disabled={submission.loading}
                  sx={{ minWidth: 90 }}
                >
                  {c.back}
                </Button>

                <Stack direction="row" spacing={1}>
                  {isOptional && (
                    <Button
                      variant="text"
                      onClick={isLastStep ? () => handleFinish(false) : goNext}
                      disabled={submission.loading}
                      sx={carouselSkipButtonSx}
                    >
                      {c.skip}
                    </Button>
                  )}
                  {isLastStep ? (
                    <LoadingButton
                      type="button"
                      loading={submission.loading}
                      onClick={() => handleFinish(true)}
                    >
                      {c.finish}
                    </LoadingButton>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={goNext}
                      disabled={submission.loading}
                      sx={{
                        ...carouselNextButtonSx,
                        background: brandGradient(theme),
                        "&:hover": { background: brandGradientHover(theme) },
                      }}
                    >
                      {c.next}
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Completion progress bar — shown below the panel on all non-done steps */}
        {!isDone && (
          <Box sx={{ width: "100%", mt: 2.5 }}>
            <ProfileCompletionProgressBar step={currentStep} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Export the step array so tests can reference the total step count.
export { ONBOARDING_STEPS };
