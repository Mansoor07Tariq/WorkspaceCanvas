import { useState } from "react";

export interface SubmissionState {
  loading: boolean;
  generalError: string | undefined;
}

const initialSubmission: SubmissionState = {
  loading: false,
  generalError: undefined,
};

export function useFormSubmission() {
  const [submission, setSubmission] = useState<SubmissionState>(initialSubmission);

  function startSubmission() {
    setSubmission({ loading: true, generalError: undefined });
  }

  function setGeneralError(error: string | undefined) {
    setSubmission((prev) => ({ ...prev, generalError: error }));
  }

  function endSubmission() {
    setSubmission((prev) => ({ ...prev, loading: false }));
  }

  function resetSubmission() {
    setSubmission(initialSubmission);
  }

  return { submission, startSubmission, setGeneralError, endSubmission, resetSubmission };
}
