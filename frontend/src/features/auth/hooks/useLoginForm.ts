import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "@/hooks/useForm";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { usePostAuthNavigation } from "@/hooks/usePostAuthNavigation";
import { login } from "../api/authApi";
import { isMfaRequiredResponse, navigateToMfaChallenge } from "../utils/authUtils";
import { validateLoginForm } from "../utils/loginValidation";
import { extractLoginFieldErrors } from "../utils/authErrorUtils";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import type { LoginFieldErrors } from "../types/login.types";

interface LoginFields {
  email: string;
  password: string;
}

export function useLoginForm() {
  const navigate = useNavigate();
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();
  const { navigateAfterAuth } = usePostAuthNavigation();
  const { fields, setField } = useForm<LoginFields>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const errors = validateLoginForm(fields.email, fields.password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startSubmission();

    try {
      const response = await login({ email: fields.email, password: fields.password });
      if (isMfaRequiredResponse(response)) {
        navigateToMfaChallenge(navigate, response.challenge_id, fields.email);
      } else {
        const error = await navigateAfterAuth(response);
        if (error) setGeneralError(error);
      }
    } catch (err: unknown) {
      const fieldErrs = extractLoginFieldErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setFieldErrors(fieldErrs);
      } else {
        setGeneralError(getApiErrorMessage(err));
      }
    } finally {
      endSubmission();
    }
  }

  return { fields, setField, fieldErrors, submission, handleSubmit };
}
