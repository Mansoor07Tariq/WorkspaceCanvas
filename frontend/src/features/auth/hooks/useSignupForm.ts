import { useState } from "react";
import { useForm } from "@/hooks/useForm";
import type { SubmissionState } from "@/hooks/useFormSubmission";
import { signup } from "../api/authApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { validateSignupForm, validatePasswordConfirmation } from "../utils/signupValidation";
import { extractSignupFieldErrors } from "../utils/authErrorUtils";
import type { SignupFieldErrors } from "../types/signup.types";

interface SignupFields {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface SignupSubmissionState extends SubmissionState {
  success: boolean;
  submittedEmail: string;
}

const initialFields: SignupFields = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const initialSubmission: SignupSubmissionState = {
  loading: false,
  success: false,
  submittedEmail: "",
  generalError: undefined,
};

export function useSignupForm() {
  const { fields, setField } = useForm<SignupFields>(initialFields);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [submission, setSubmission] = useState<SignupSubmissionState>(initialSubmission);

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const errors = validateSignupForm(fields.fullName, fields.email, fields.password);
    const confirmErr = validatePasswordConfirmation(fields.password, fields.confirmPassword);
    if (confirmErr) errors.confirmPassword = confirmErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmission((prev) => ({ ...prev, loading: true, generalError: undefined }));

    signup({
      email: fields.email,
      password: fields.password,
      ...(fields.fullName.trim() ? { full_name: fields.fullName.trim() } : {}),
    })
      .then(() => {
        setSubmission((prev) => ({ ...prev, success: true, submittedEmail: fields.email }));
      })
      .catch((err: unknown) => {
        const fieldErrs = extractSignupFieldErrors(err);
        if (Object.keys(fieldErrs).length > 0) {
          setFieldErrors(fieldErrs);
        } else {
          setSubmission((prev) => ({ ...prev, generalError: getApiErrorMessage(err) }));
        }
      })
      .finally(() => {
        setSubmission((prev) => ({ ...prev, loading: false }));
      });
  }

  return { fields, setField, fieldErrors, submission, handleSubmit };
}
