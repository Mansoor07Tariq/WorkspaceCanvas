import { useState } from "react";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { createLayoutObject } from "../api/layoutObjectApi";
import type {
  LayoutObject,
  LayoutObjectFieldErrors,
  LayoutObjectFormFields,
  LayoutObjectType,
} from "../types/layoutObject.types";
import {
  buildLayoutObjectPayload,
  makeDefaultFields,
  validateLayoutObjectFields,
} from "../utils/layoutObjectValidation";

interface UseLayoutObjectFormParams {
  officeId: number;
  floorId: number;
  onCreated: (obj: LayoutObject) => void;
}

export function useLayoutObjectForm({ officeId, floorId, onCreated }: UseLayoutObjectFormParams) {
  const [fields, setFieldsState] = useState<LayoutObjectFormFields>(makeDefaultFields());
  const [fieldErrors, setFieldErrors] = useState<LayoutObjectFieldErrors>({});
  const { submission, startSubmission, setGeneralError, endSubmission, resetSubmission } =
    useFormSubmission();

  function setField<K extends keyof LayoutObjectFormFields>(
    key: K,
    value: LayoutObjectFormFields[K]
  ) {
    setFieldsState((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === "object_type" && value) {
      const objectType = value as LayoutObjectType;
      const newFields = makeDefaultFields(objectType);
      setFieldsState((prev) => ({
        ...prev,
        object_type: objectType,
        width: prev.width !== "80" ? prev.width : newFields.width,
        height: prev.height !== "50" ? prev.height : newFields.height,
      }));
    }
  }

  async function handleCreate() {
    const errors = validateLayoutObjectFields(fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    startSubmission();
    try {
      const payload = buildLayoutObjectPayload(fields);
      const created = await createLayoutObject(officeId, floorId, payload);
      resetSubmission();
      setFieldsState(makeDefaultFields());
      setFieldErrors({});
      onCreated(created);
    } catch (err) {
      setGeneralError(getApiErrorMessage(err));
      endSubmission();
    }
  }

  return { fields, setField, fieldErrors, submission, handleCreate };
}
