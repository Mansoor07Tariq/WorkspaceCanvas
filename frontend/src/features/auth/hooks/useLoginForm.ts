import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "@/hooks/useForm";
import { login, getCurrentUser } from "../api/authApi";
import { isMfaRequiredResponse } from "../utils/authUtils";
import { tokenStorage } from "@/lib/tokenStorage";
import { ROUTES } from "@/routes/paths";
import { validateLoginForm } from "../utils/loginValidation";
import { extractLoginFieldErrors } from "../utils/authErrorUtils";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { useAuth } from "../context/AuthContext";
import type { LoginFieldErrors } from "../types/login.types";

interface LoginFields {
  email: string;
  password: string;
}

interface SubmissionState {
  loading: boolean;
  generalError: string | undefined;
}

const initialSubmission: SubmissionState = {
  loading: false,
  generalError: undefined,
};

export function useLoginForm() {
  const navigate = useNavigate();
  const { setAuthenticatedUser } = useAuth();
  const { fields, setField } = useForm<LoginFields>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submission, setSubmission] = useState<SubmissionState>(initialSubmission);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors = validateLoginForm(fields.email, fields.password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmission({ loading: true, generalError: undefined });

    try {
      const response = await login({ email: fields.email, password: fields.password });
      if (isMfaRequiredResponse(response)) {
        navigate(ROUTES.mfaChallenge, {
          state: { challengeId: response.challenge_id, email: fields.email },
        });
      } else {
        tokenStorage.setTokens(response.access, response.refresh);
        try {
          const user = await getCurrentUser();
          setAuthenticatedUser(user);
          navigate(ROUTES.app);
        } catch (err: unknown) {
          tokenStorage.clearTokens();
          setSubmission((prev) => ({ ...prev, generalError: getApiErrorMessage(err) }));
        }
      }
    } catch (err: unknown) {
      const fieldErrs = extractLoginFieldErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setFieldErrors(fieldErrs);
      } else {
        setSubmission((prev) => ({ ...prev, generalError: getApiErrorMessage(err) }));
      }
    } finally {
      setSubmission((prev) => ({ ...prev, loading: false }));
    }
  }

  return { fields, setField, fieldErrors, submission, handleSubmit };
}
