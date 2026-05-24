import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { AccountCircleOutlined } from "@mui/icons-material";
import { FormTextField } from "@/components/ui/FormTextField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { en } from "@/i18n/en";
import { useProfileSetupForm } from "../hooks/useProfileSetupForm";

export function ProfileSetupCard() {
  const { fields, setField, fieldErrors, submission, handleSubmit } = useProfileSetupForm();

  return (
    <Box sx={{ p: 4, maxWidth: 480, mx: "auto", mt: 6 }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AccountCircleOutlined color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  {en.app.profile.setupTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {en.app.profile.setupSubtitle}
                </Typography>
              </Box>
            </Stack>

            <ErrorAlert message={submission.generalError} />

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.5}>
                <FormTextField
                  id="full-name"
                  label={en.app.profile.fullName}
                  value={fields.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  error={fieldErrors.fullName}
                  disabled={submission.loading}
                  autoComplete="name"
                  autoFocus
                />
                <FormTextField
                  id="job-title"
                  label={en.app.profile.jobTitle}
                  value={fields.jobTitle}
                  onChange={(e) => setField("jobTitle", e.target.value)}
                  disabled={submission.loading}
                  autoComplete="organization-title"
                />
                <FormTextField
                  id="phone-number"
                  label={en.app.profile.phoneNumber}
                  value={fields.phoneNumber}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                  error={fieldErrors.phoneNumber}
                  disabled={submission.loading}
                  autoComplete="tel"
                  inputMode="tel"
                />
                <LoadingButton loading={submission.loading}>
                  {en.app.profile.saveButton}
                </LoadingButton>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
