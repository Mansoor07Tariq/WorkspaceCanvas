import { useMemo } from "react";
import { Box, Button, Paper, Stack, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { keyframes } from "@mui/system";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { en } from "@/i18n/en";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useProfileOnboardingForm, ONBOARDING_STEPS } from "../hooks/useProfileOnboardingForm";
import type { OnboardingStep } from "../hooks/useProfileOnboardingForm";
import { ProfileOnboardingBackground } from "./onboarding/ProfileOnboardingBackground";
import { ProfileOnboardingProgress } from "./onboarding/ProfileOnboardingProgress";
import { ProfileCompletionProgressBar } from "./onboarding/ProfileCompletionProgressBar";
import { StepWelcome } from "./carousel/StepWelcome";
import { StepName } from "./carousel/StepName";
import { StepEmail } from "./carousel/StepEmail";
import { StepWorkDetails } from "./carousel/StepWorkDetails";
import { StepAvatar } from "./carousel/StepAvatar";
import { StepDone } from "./carousel/StepDone";

const OPTIONAL_STEPS: OnboardingStep[] = ["workDetails", "avatar"];

const stepIn = keyframes({
  from: { opacity: 0, transform: "translateY(14px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);
}

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
  const isOptional = OPTIONAL_STEPS.includes(currentStep);

  function renderStep() {
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
    }
  }

  // MUI AppBar is 64px on desktop; fill the remaining viewport height.
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "calc(100vh - 64px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: { xs: 2, sm: 3 },
        pt: { xs: 3, sm: 4 },
        pb: 4,
      }}
    >
      {/* Decorative background layer */}
      <ProfileOnboardingBackground />

      {/* All content above background */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexGrow: 1,
        }}
      >
        {/* Step progress — visible on all steps */}
        <ProfileOnboardingProgress stepIndex={stepIndex} />

        {/* Glassmorphism content panel */}
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            p: { xs: 3, sm: 4, md: 5 },
            background: `rgba(255, 255, 255, 0.88)`,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 4,
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.1),
            boxShadow:
              "0 4px 6px rgba(0,0,0,0.04), 0 16px 48px rgba(37,99,235,0.08), 0 2px 4px rgba(0,0,0,0.04)",
          }}
        >
          <Stack spacing={3}>
            <ErrorAlert message={submission.generalError} />

            {/* Animated step content */}
            <Box
              key={currentStep}
              sx={
                reducedMotion
                  ? undefined
                  : {
                      animation: `${stepIn} 0.3s ease-out both`,
                    }
              }
            >
              {renderStep()}
            </Box>

            {/* Navigation — hidden on welcome and done */}
            {!isWelcome && !isDone && (
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: "space-between", pt: 1 }}>
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
                      sx={{ color: "text.secondary" }}
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
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        "&:hover": {
                          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                        },
                        minWidth: 90,
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
            <ProfileCompletionProgressBar stepIndex={stepIndex} />
          </Box>
        )}

        {/* Steps count context — visible on active steps */}
        {!isWelcome && !isDone && (
          <Box sx={{ mt: 1.5, opacity: 0.5 }}>
            {/* intentionally empty: progress bar + stepper already provide context */}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Export the step array so tests can reference the total step count.
export { ONBOARDING_STEPS };
