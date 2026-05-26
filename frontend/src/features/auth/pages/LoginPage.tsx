import { Link as RouterLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { FormTextField } from "@/components/ui/FormTextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { ROUTES } from "@/routes/paths";
import { AuthPageShell } from "../components/AuthPageShell";
import { SocialLoginButtons } from "../components/SocialLoginButtons";
import { useLoginForm } from "../hooks/useLoginForm";
import { useSocialLogin } from "../hooks/useSocialLogin";
import { authFormSx } from "../styles/auth.styles";

export function LoginPage() {
  const { fields, setField, fieldErrors, submission, handleSubmit } = useLoginForm();
  const social = useSocialLogin();

  const isLoading = submission.loading || social.loadingProvider !== undefined;

  return (
    <AuthPageShell
      title={en.auth.login.title}
      subtitle={en.auth.login.subtitle}
      footer={
        <>
          {en.auth.login.noAccount}{" "}
          <Typography component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
            <RouterLink to={ROUTES.signup} style={{ color: "inherit", textDecoration: "none" }}>
              {en.auth.login.createAccount}
            </RouterLink>
          </Typography>
        </>
      }
    >
      <ErrorAlert message={submission.generalError} />
      <Box component="form" onSubmit={handleSubmit} noValidate sx={authFormSx}>
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
          autoComplete="current-password"
        />
        <LoadingButton loading={submission.loading} disabled={isLoading}>
          {en.auth.login.submit}
        </LoadingButton>
      </Box>
      <SocialLoginButtons
        google={social.google}
        microsoft={social.microsoft}
        loadingProvider={social.loadingProvider}
        generalError={social.generalError}
      />
    </AuthPageShell>
  );
}
