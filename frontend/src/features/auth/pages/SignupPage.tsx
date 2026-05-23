import { Link as RouterLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { en } from "@/i18n/en";
import { CenteredPageLayout } from "@/components/layout/CenteredPageLayout";
import { FormTextField } from "@/components/ui/FormTextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { ROUTES } from "@/routes/paths";
import { AuthCard } from "../components/AuthCard";
import { AuthPageShell } from "../components/AuthPageShell";
import { SocialLoginButtons } from "../components/SocialLoginButtons";
import { useSignupForm } from "../hooks/useSignupForm";
import { useSocialLogin } from "../hooks/useSocialLogin";
import {
  authFormSx,
  signupSuccessBoxSx,
  signupSuccessIconSx,
  signupSuccessTitleSx,
  signupSuccessMessageSx,
  signupSuccessEmailSx,
  signupSuccessHintSx,
} from "../styles/auth.styles";

export function SignupPage() {
  const { fields, setField, fieldErrors, submission, handleSubmit } = useSignupForm();
  const social = useSocialLogin();

  const isLoading = submission.loading || social.loadingProvider !== undefined;

  if (submission.success) {
    return (
      <CenteredPageLayout>
        <AuthCard>
          <Box sx={signupSuccessBoxSx}>
            <CheckCircleIcon sx={signupSuccessIconSx} />
            <Typography variant="h5" sx={signupSuccessTitleSx}>
              {en.auth.signup.successTitle}
            </Typography>
            <Typography variant="body2" sx={signupSuccessMessageSx}>
              {en.auth.signup.successMessage}{" "}
              <Box component="span" sx={signupSuccessEmailSx}>
                {submission.submittedEmail}
              </Box>
              .
            </Typography>
            <Typography variant="body2" sx={signupSuccessHintSx}>
              {en.auth.signup.verificationRequired}
            </Typography>
            <RouterLink
              to={ROUTES.login}
              style={{ color: "#2563EB", fontWeight: 600, fontSize: "0.875rem" }}
            >
              {en.auth.signup.backToSignIn}
            </RouterLink>
          </Box>
        </AuthCard>
      </CenteredPageLayout>
    );
  }

  return (
    <AuthPageShell
      title={en.auth.signup.title}
      subtitle={en.auth.signup.subtitle}
      footer={
        <>
          {en.auth.signup.alreadyHaveAccount}{" "}
          <RouterLink
            to={ROUTES.login}
            style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}
          >
            {en.auth.signup.signIn}
          </RouterLink>
        </>
      }
    >
      <ErrorAlert message={submission.generalError} />
      <Box component="form" onSubmit={handleSubmit} noValidate sx={authFormSx}>
        <FormTextField
          id="full-name"
          label={en.auth.fields.fullName}
          value={fields.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
          error={fieldErrors.full_name}
          disabled={isLoading}
          autoComplete="name"
          placeholder={en.auth.fields.fullNamePlaceholder}
        />
        <FormTextField
          id="email"
          label={en.auth.fields.email}
          type="email"
          value={fields.email}
          onChange={(e) => setField("email", e.target.value)}
          error={fieldErrors.email}
          disabled={isLoading}
          autoComplete="email"
          placeholder={en.auth.fields.emailPlaceholder}
        />
        <PasswordField
          id="password"
          label={en.auth.fields.password}
          value={fields.password}
          onChange={(e) => setField("password", e.target.value)}
          error={fieldErrors.password}
          disabled={isLoading}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-password"
          label={en.auth.fields.confirmPassword}
          value={fields.confirmPassword}
          onChange={(e) => setField("confirmPassword", e.target.value)}
          error={fieldErrors.confirmPassword}
          disabled={isLoading}
          autoComplete="new-password"
        />
        <LoadingButton loading={submission.loading} disabled={isLoading}>
          {en.auth.signup.submit}
        </LoadingButton>
      </Box>
      <SocialLoginButtons
        isGoogleConfigured={social.isGoogleConfigured}
        isMicrosoftConfigured={social.isMicrosoftConfigured}
        onGoogleStart={social.startGoogleFlow}
        onGoogleToken={social.handleGoogleToken}
        onGoogleError={social.handleGoogleError}
        onGoogleUnavailable={social.handleGoogleUnavailable}
        onMicrosoftStart={social.startMicrosoftFlow}
        onMicrosoftToken={social.handleMicrosoftToken}
        onMicrosoftError={social.handleMicrosoftError}
        onMicrosoftUnavailable={social.handleMicrosoftUnavailable}
        loadingProvider={social.loadingProvider}
        generalError={social.generalError}
      />
    </AuthPageShell>
  );
}
