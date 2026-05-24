import { Box, Step, StepLabel, Stepper, useTheme } from "@mui/material";
import { en } from "@/i18n/en";

interface Props {
  stepIndex: number;
}

const c = en.app.profile.carousel;

const STEPS = [c.stepWelcome, c.stepName, c.stepEmail, c.stepWorkDetails, c.stepAvatar, c.stepDone];

export function ProfileOnboardingProgress({ stepIndex }: Props) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mb: 2,
        "& .MuiStepLabel-label": {
          fontSize: "0.65rem",
          mt: 0.5,
          transition: "color 0.3s ease, font-weight 0.3s ease",
        },
        "& .MuiStepLabel-label.Mui-active": {
          color: theme.palette.primary.main,
          fontWeight: 700,
        },
        "& .MuiStepLabel-label.Mui-completed": {
          color: theme.palette.text.secondary,
          fontWeight: 400,
        },
        "& .MuiStepIcon-root": {
          width: 22,
          height: 22,
          transition: "color 0.3s ease",
        },
        "& .MuiStepIcon-root.Mui-active": {
          color: theme.palette.primary.main,
          filter: `drop-shadow(0 0 4px ${theme.palette.primary.main}55)`,
        },
        "& .MuiStepIcon-root.Mui-completed": {
          color: theme.palette.primary.main,
        },
        "& .MuiStepConnector-line": {
          borderColor: theme.palette.divider,
          transition: "border-color 0.5s ease",
        },
        "& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line": {
          borderColor: theme.palette.primary.main,
        },
        "& .MuiStepIcon-text": {
          fontSize: "0.55rem",
        },
      }}
    >
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
