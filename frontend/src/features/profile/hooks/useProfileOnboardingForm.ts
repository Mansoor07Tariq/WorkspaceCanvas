import { useEffect, useRef, useState } from "react";
import { useForm } from "@/hooks/useForm";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { resolveMediaUrl } from "@/lib/resolveMediaUrl";
import { updateProfile, uploadAvatar } from "../api/profileApi";
import { validateProfileForm } from "../utils/profileValidation";
import { validateAvatarFile } from "../utils/avatarValidation";
import { ONBOARDING_STEPS } from "../types/profile.types";
import type { ProfileFieldErrors } from "../types/profile.types";
import type { CurrentUser } from "@/features/auth/types/auth.types";

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

/**
 * PR 057 (Error 1): the display name to prefill from the authenticated user.
 * Prefer `full_name`; fall back to `first_name last_name` so a Google account
 * that only yields given/family names still prefills.
 */
function userDisplayName(user: CurrentUser | null): string {
  const full = user?.full_name?.trim();
  if (full) return full;
  const composed = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  return composed;
}

// PR 057 (Error 3): how long the full-screen "Setting up your workspace…"
// overlay stays up before we flip the auth user and hand off to the dashboard.
export const PROFILE_COMPLETION_TRANSITION_MS = 2200;

export function useProfileOnboardingForm() {
  const { user, setAuthenticatedUser } = useAuth();
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();

  const { fields, setField } = useForm<TextFields>({
    fullName: userDisplayName(user),
    jobTitle: user?.job_title?.trim() ?? "",
    phoneNumber: user?.phone_number?.trim() ?? "",
    timezone: getInitialTimezone(user?.timezone),
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | undefined>(undefined);
  const [completing, setCompleting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PR 057 (Errors 1 & 2): seed the form from the authenticated user once it
  // loads. The form can mount before `user` is fetched (e.g. straight after a
  // Google redirect), in which case the initial useForm() values were empty;
  // this re-seeds the Google name / existing avatar exactly once per user, and
  // only from non-empty server values so it never clobbers what the user typed.
  // (Intentional state-sync-from-async-prop — the canonical use for an effect.)
  const seededUserIdRef = useRef<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- seeding form once from async-loaded user */
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid === null || seededUserIdRef.current === uid) return;
    seededUserIdRef.current = uid;
    const name = userDisplayName(user);
    if (name) setField("fullName", name);
    if (user?.job_title?.trim()) setField("jobTitle", user.job_title.trim());
    if (user?.phone_number?.trim()) setField("phoneNumber", user.phone_number.trim());
    // Prefill the avatar preview from the existing (e.g. Google) avatar when the
    // user has not picked a local file. The MUI Avatar renders the remote URL.
    if (user?.avatar && !avatarFile) setAvatarPreview(resolveMediaUrl(user.avatar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
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
        endSubmission();
        // PR 057 (Error 3): show a controlled full-screen transition overlay for
        // ~2.2s before flipping the auth user. Updating the user immediately
        // would make DashboardPage swap from the onboarding carousel to the app
        // instantly (abrupt). We delay the hand-off so it feels intentional.
        setCompleting(true);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = setTimeout(() => {
          setAuthenticatedUser(finalUser);
          setCompleting(false);
        }, PROFILE_COMPLETION_TRANSITION_MS);
      })
      .catch((err: unknown) => {
        setGeneralError(getApiErrorMessage(err));
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
    completing,
    selectAvatarFile,
    clearAvatarFile,
    goNext,
    goBack,
    handleFinish,
  };
}
