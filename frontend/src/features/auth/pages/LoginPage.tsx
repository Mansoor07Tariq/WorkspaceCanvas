import { Link as RouterLink } from "react-router-dom";
import { Box } from "@mui/material";
import { en } from "@/i18n/en";
import { FormTextField } from "@/components/ui/FormTextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { ROUTES } from "@/routes/paths";
import { AuthPageShell } from "../components/AuthPageShell";
import { useLoginForm } from "../hooks/useLoginForm";
import { authFormSx } from "../styles/auth.styles";

export function LoginPage() {
  const { fields, setField, fieldErrors, submission, handleSubmit } = useLoginForm();

  return (
    <AuthPageShell
      title={en.auth.login.title}
      subtitle={en.auth.login.subtitle}
      footer={
        <>
          {en.auth.login.noAccount}{" "}
          <RouterLink
            to={ROUTES.signup}
            style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}
          >
            {en.auth.login.createAccount}
          </RouterLink>
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
          disabled={submission.loading}
          autoComplete="email"
          placeholder={en.auth.fields.emailPlaceholder}
        />
        <PasswordField
          id="password"
          label={en.auth.fields.password}
          value={fields.password}
          onChange={(e) => setField("password", e.target.value)}
          error={fieldErrors.password}
          disabled={submission.loading}
          autoComplete="current-password"
        />
        <LoadingButton loading={submission.loading}>{en.auth.login.submit}</LoadingButton>
      </Box>
    </AuthPageShell>
  );
}
