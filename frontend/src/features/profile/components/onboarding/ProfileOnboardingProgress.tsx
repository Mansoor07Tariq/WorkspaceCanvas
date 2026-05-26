import { Box, Step, StepLabel, Stepper } from "@mui/material";
import { en } from "@/i18n/en";
import { onboardingProgressSx } from "../../styles/profile.styles";

interface Props {
  stepIndex: number;
}

const c = en.app.profile.carousel;

const STEPS = [c.stepWelcome, c.stepName, c.stepEmail, c.stepWorkDetails, c.stepAvatar, c.stepDone];

export function ProfileOnboardingProgress({ stepIndex }: Props) {
  return (
    <Box sx={onboardingProgressSx}>
      <Stepper activeStep={stepIndex} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
