import { useState } from "react";
import { useForm } from "@/hooks/useForm";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { usePostAuthNavigation } from "@/hooks/usePostAuthNavigation";
import { verifyMfaChallenge } from "../api/authApi";
import { validateMfaChallengeForm } from "../utils/mfaChallengeValidation";
import { extractMfaChallengeFieldErrors } from "../utils/authErrorUtils";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import type { MfaChallengeFieldErrors, MfaChallengeMode } from "../types/mfaChallenge.types";

interface MfaChallengeFields {
  token: string;
  recoveryCode: string;
}

export function useMfaChallengeForm(challengeId: string) {
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();
  const { navigateAfterAuth } = usePostAuthNavigation();
  const [mode, setMode] = useState<MfaChallengeMode>("totp");
  const { fields, setField } = useForm<MfaChallengeFields>({ token: "", recoveryCode: "" });
  const [fieldErrors, setFieldErrors] = useState<MfaChallengeFieldErrors>({});

  function toggleMode() {
    setMode((prev) => (prev === "totp" ? "recovery" : "totp"));
    setFieldErrors({});
    setGeneralError(undefined);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const errors = validateMfaChallengeForm(mode, fields.token, fields.recoveryCode);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startSubmission();

    const payload =
      mode === "totp"
        ? { challenge_id: challengeId, token: fields.token }
        : { challenge_id: challengeId, recovery_code: fields.recoveryCode.trim() };

    try {
      const response = await verifyMfaChallenge(payload);
      const error = await navigateAfterAuth(response);
      if (error) setGeneralError(error);
    } catch (err: unknown) {
      const fieldErrs = extractMfaChallengeFieldErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setFieldErrors(fieldErrs);
      } else {
        setGeneralError(getApiErrorMessage(err));
      }
    } finally {
      endSubmission();
    }
  }

  return { mode, toggleMode, fields, setField, fieldErrors, submission, handleSubmit };
}
