import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "@/hooks/useForm";
import { verifyMfaChallenge, getCurrentUser } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { ROUTES } from "@/routes/paths";
import { validateMfaChallengeForm } from "../utils/mfaChallengeValidation";
import { extractMfaChallengeFieldErrors } from "../utils/authErrorUtils";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { useAuth } from "../context/AuthContext";
import type { MfaChallengeFieldErrors, MfaChallengeMode } from "../types/mfaChallenge.types";

interface MfaChallengeFields {
  token: string;
  recoveryCode: string;
}

interface SubmissionState {
  loading: boolean;
  generalError: string | undefined;
}

const initialSubmission: SubmissionState = {
  loading: false,
  generalError: undefined,
};

export function useMfaChallengeForm(challengeId: string) {
  const navigate = useNavigate();
  const { setAuthenticatedUser } = useAuth();
  const [mode, setMode] = useState<MfaChallengeMode>("totp");
  const { fields, setField } = useForm<MfaChallengeFields>({ token: "", recoveryCode: "" });
  const [fieldErrors, setFieldErrors] = useState<MfaChallengeFieldErrors>({});
  const [submission, setSubmission] = useState<SubmissionState>(initialSubmission);

  function toggleMode() {
    setMode((prev) => (prev === "totp" ? "recovery" : "totp"));
    setFieldErrors({});
    setSubmission((prev) => ({ ...prev, generalError: undefined }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors = validateMfaChallengeForm(mode, fields.token, fields.recoveryCode);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmission({ loading: true, generalError: undefined });

    const payload =
      mode === "totp"
        ? { challenge_id: challengeId, token: fields.token }
        : { challenge_id: challengeId, recovery_code: fields.recoveryCode.trim() };

    try {
      const response = await verifyMfaChallenge(payload);
      tokenStorage.setTokens(response.access, response.refresh);
      try {
        const user = await getCurrentUser();
        setAuthenticatedUser(user);
        navigate(ROUTES.app);
      } catch (err: unknown) {
        tokenStorage.clearTokens();
        setSubmission((prev) => ({ ...prev, generalError: getApiErrorMessage(err) }));
      }
    } catch (err: unknown) {
      const fieldErrs = extractMfaChallengeFieldErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setFieldErrors(fieldErrs);
      } else {
        setSubmission((prev) => ({ ...prev, generalError: getApiErrorMessage(err) }));
      }
    } finally {
      setSubmission((prev) => ({ ...prev, loading: false }));
    }
  }

  return { mode, toggleMode, fields, setField, fieldErrors, submission, handleSubmit };
}
