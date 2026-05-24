import { useState } from "react";
import { useForm } from "@/hooks/useForm";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { updateProfile } from "../api/profileApi";
import { validateProfileForm } from "../utils/profileValidation";
import type { ProfileFieldErrors } from "../types/profile.types";

interface ProfileFields {
  fullName: string;
  jobTitle: string;
  phoneNumber: string;
}

interface SubmissionState {
  loading: boolean;
  generalError: string | undefined;
}

const initialFields: ProfileFields = {
  fullName: "",
  jobTitle: "",
  phoneNumber: "",
};

const initialSubmission: SubmissionState = {
  loading: false,
  generalError: undefined,
};

export function useProfileSetupForm() {
  const { setAuthenticatedUser } = useAuth();
  const { fields, setField } = useForm<ProfileFields>(initialFields);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [submission, setSubmission] = useState<SubmissionState>(initialSubmission);

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const errors = validateProfileForm(fields.fullName, fields.phoneNumber);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmission({ loading: true, generalError: undefined });

    updateProfile({
      full_name: fields.fullName.trim(),
      ...(fields.jobTitle.trim() && { job_title: fields.jobTitle.trim() }),
      ...(fields.phoneNumber.trim() && { phone_number: fields.phoneNumber.trim() }),
    })
      .then((updatedUser) => {
        setAuthenticatedUser(updatedUser);
      })
      .catch((err: unknown) => {
        setSubmission((prev) => ({ ...prev, generalError: getApiErrorMessage(err) }));
      })
      .finally(() => {
        setSubmission((prev) => ({ ...prev, loading: false }));
      });
  }

  return { fields, setField, fieldErrors, submission, handleSubmit };
}
