import { useState } from "react";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { createOrganization } from "../api/organizationApi";
import { validateOrgSetupStep } from "../utils/orgValidation";
import { ORG_SETUP_STEPS } from "../types/organization.types";
import type { OrgFieldErrors, OrgSetupStep, OrgType } from "../types/organization.types";

interface OrgFormFields {
  name: string;
  organization_type: OrgType;
  allowed_email_domain: string;
}

export function useOrgSetupForm(onCreated: () => void) {
  const { refreshUser } = useAuth();
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<OrgFieldErrors>({});
  const [fields, setFields] = useState<OrgFormFields>({
    name: "",
    organization_type: "company",
    allowed_email_domain: "",
  });

  const currentStep: OrgSetupStep = ORG_SETUP_STEPS[stepIndex];
  const isWelcomeStep = stepIndex === 0;
  const isReviewStep = currentStep === "review";

  function setField<K extends keyof OrgFormFields>(key: K, value: OrgFormFields[K]) {
    const normalized =
      key === "allowed_email_domain" && typeof value === "string"
        ? (value.toLowerCase() as OrgFormFields[K])
        : value;
    setFields((prev) => ({ ...prev, [key]: normalized }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateCurrentStep(): boolean {
    const errors = validateOrgSetupStep(currentStep, fields.name, fields.allowed_email_domain);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (stepIndex < ORG_SETUP_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }

  function goSkip() {
    setField("allowed_email_domain", "");
    setFieldErrors({});
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    setFieldErrors({});
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }

  function handleCreate() {
    if (!validateCurrentStep()) return;
    startSubmission();

    const payload: Parameters<typeof createOrganization>[0] = {
      name: fields.name.trim(),
      organization_type: fields.organization_type,
      ...(fields.allowed_email_domain.trim() && {
        allowed_email_domain: fields.allowed_email_domain.trim(),
      }),
    };

    createOrganization(payload)
      .then(() => refreshUser())
      .then(() => onCreated())
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
    isWelcomeStep,
    isReviewStep,
    fieldErrors,
    submission,
    goNext,
    goSkip,
    goBack,
    handleCreate,
  };
}
