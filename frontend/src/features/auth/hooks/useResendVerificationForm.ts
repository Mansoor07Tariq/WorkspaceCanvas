import { useState } from "react";
import { useForm } from "@/hooks/useForm";
import { resendVerification } from "../api/authApi";
import { validateResendVerificationForm } from "../utils/emailVerificationValidation";
import { extractResendVerificationFieldErrors } from "../utils/authErrorUtils";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import type { ResendVerificationFieldErrors } from "../types/emailVerification.types";

interface ResendFields {
  email: string;
}

interface SubmissionState {
  loading: boolean;
  successMessage?: string;
  generalError?: string;
}

const initialSubmission: SubmissionState = { loading: false };

export function useResendVerificationForm() {
  const { fields, setField } = useForm<ResendFields>({ email: "" });
  const [fieldErrors, setFieldErrors] = useState<ResendVerificationFieldErrors>({});
  const [submission, setSubmission] = useState<SubmissionState>(initialSubmission);

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const errors = validateResendVerificationForm(fields.email);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmission({ loading: true });

    resendVerification({ email: fields.email })
      .then(() => {
        setSubmission({ loading: false, successMessage: en.auth.verifyEmail.resendSuccess });
      })
      .catch((err: unknown) => {
        const fieldErrs = extractResendVerificationFieldErrors(err);
        if (Object.keys(fieldErrs).length > 0) {
          setFieldErrors(fieldErrs);
          setSubmission({ loading: false });
        } else {
          setSubmission({ loading: false, generalError: getApiErrorMessage(err) });
        }
      });
  }

  return { fields, setField, fieldErrors, submission, handleSubmit };
}
