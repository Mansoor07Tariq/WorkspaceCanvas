import { useState } from "react";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { createFloor } from "../api/floorApi";
import { validateFloorStep, buildFloorPayload } from "../utils/floorValidation";
import { FLOOR_CREATION_STEPS } from "../types/floor.types";
import type {
  FloorCreationStep,
  FloorFieldErrors,
  FloorFormFields,
  Floor,
} from "../types/floor.types";

export function useFloorCreationForm(officeId: number, onCreated: (floor: Floor) => void) {
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FloorFieldErrors>({});
  const [fields, setFields] = useState<FloorFormFields>({
    name: "",
    level_number: "0",
  });

  const currentStep: FloorCreationStep = FLOOR_CREATION_STEPS[stepIndex];
  const isReviewStep = currentStep === "review";
  const isFirstStep = stepIndex === 0;

  function setField<K extends keyof FloorFormFields>(key: K, value: FloorFormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateCurrentStep(): boolean {
    const errors = validateFloorStep(currentStep, fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (stepIndex < FLOOR_CREATION_STEPS.length - 1) {
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
    createFloor(officeId, buildFloorPayload(fields))
      .then((floor) => onCreated(floor))
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
    isReviewStep,
    isFirstStep,
    fieldErrors,
    submission,
    stepIndex,
    goNext,
    goBack,
    handleCreate,
  };
}
