import { useEffect, useRef, useState } from "react";
import { useForm } from "@/hooks/useForm";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { updateProfile, uploadAvatar } from "../api/profileApi";
import { validateProfileForm } from "../utils/profileValidation";
import { validateAvatarFile } from "../utils/avatarValidation";
import { ONBOARDING_STEPS } from "../types/profile.types";
import type { ProfileFieldErrors } from "../types/profile.types";

interface TextFields {
  fullName: string;
  jobTitle: string;
  phoneNumber: string;
  timezone: string;
}

function getInitialTimezone(tz: string | undefined): string {
  if (tz && tz !== "UTC") return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useProfileOnboardingForm() {
  const { user, setAuthenticatedUser } = useAuth();
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();

  const { fields, setField } = useForm<TextFields>({
    fullName: user?.full_name?.trim() ?? "",
    jobTitle: user?.job_title?.trim() ?? "",
    phoneNumber: user?.phone_number?.trim() ?? "",
    timezone: getInitialTimezone(user?.timezone),
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | undefined>(undefined);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 2;

  function selectAvatarFile(file: File) {
    const error = validateAvatarFile(file);
    if (error) {
      setAvatarError(error);
      return;
    }
    setAvatarError(undefined);
    setAvatarFile(file);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setAvatarPreview(url);
  }

  function clearAvatarFile() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(undefined);
  }

  function validateCurrentStep(): boolean {
    if (currentStep === "name") {
      const errors = validateProfileForm(fields.fullName, "");
      if (errors.fullName) {
        setFieldErrors({ fullName: errors.fullName });
        return false;
      }
      setFieldErrors({});
    }

    if (currentStep === "workDetails") {
      const errors = validateProfileForm("valid", fields.phoneNumber);
      if (errors.phoneNumber) {
        setFieldErrors({ phoneNumber: errors.phoneNumber });
        return false;
      }
      setFieldErrors({});
    }

    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    setFieldErrors({});
    if (stepIndex < ONBOARDING_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    setFieldErrors({});
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }

  function handleFinish(withAvatar: boolean = true) {
    if (!validateCurrentStep()) return;
    setFieldErrors({});
    startSubmission();

    const profileData: Parameters<typeof updateProfile>[0] = {
      full_name: fields.fullName.trim(),
      ...(fields.jobTitle.trim() && { job_title: fields.jobTitle.trim() }),
      ...(fields.phoneNumber.trim() && { phone_number: fields.phoneNumber.trim() }),
      ...(fields.timezone.trim() && { timezone: fields.timezone.trim() }),
    };

    updateProfile(profileData)
      .then((updatedUser) => {
        if (withAvatar && avatarFile) {
          return uploadAvatar(avatarFile).then((withAvatarUser) => withAvatarUser);
        }
        return updatedUser;
      })
      .then((finalUser) => {
        setAuthenticatedUser(finalUser);
        setStepIndex(ONBOARDING_STEPS.length - 1);
      })
      .catch((err: unknown) => {
        setGeneralError(getApiErrorMessage(err));
      })
      .finally(() => {
        endSubmission();
      });
  }

  return {
    fields,
    setField,
    stepIndex,
    currentStep,
    isLastStep,
    fieldErrors,
    avatarFile,
    avatarPreview,
    avatarError,
    submission,
    selectAvatarFile,
    clearAvatarFile,
    goNext,
    goBack,
    handleFinish,
  };
}
