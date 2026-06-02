import { useState } from "react";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { createOffice } from "../api/officeApi";
import { validateOfficeStep, buildOfficePayload } from "../utils/officeValidation";
import { OFFICE_CREATION_STEPS } from "../types/office.types";
import type {
  OfficeCreationStep,
  OfficeFieldErrors,
  OfficeFormFields,
} from "../types/office.types";
import type { Office } from "../types/office.types";

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export function useOfficeCreationForm(onCreated: (office: Office) => void, orgId?: number | null) {
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<OfficeFieldErrors>({});
  const [fields, setFields] = useState<OfficeFormFields>({
    name: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    county_or_state: "",
    country: "",
    timezone: getBrowserTimezone(),
  });

  const currentStep: OfficeCreationStep = OFFICE_CREATION_STEPS[stepIndex];
  const isWelcomeStep = stepIndex === 0;
  const isReviewStep = currentStep === "review";

  function setField<K extends keyof OfficeFormFields>(key: K, value: OfficeFormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateCurrentStep(): boolean {
    const errors = validateOfficeStep(currentStep, fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (stepIndex < OFFICE_CREATION_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
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
    createOffice(buildOfficePayload(fields), orgId)
      .then((office) => onCreated(office))
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
    currentStep,
    isWelcomeStep,
    isReviewStep,
    fieldErrors,
    submission,
    goNext,
    goBack,
    handleCreate,
  };
}
