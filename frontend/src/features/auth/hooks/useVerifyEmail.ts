import { useState, useEffect, useRef } from "react";
import { verifyEmail } from "../api/authApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import type { VerifyEmailStatus } from "../types/emailVerification.types";

export function useVerifyEmail(token: string | null) {
  const [status, setStatus] = useState<VerifyEmailStatus>(() => (token ? "verifying" : "error"));
  const [errorMessage, setErrorMessage] = useState<string | undefined>(() =>
    token ? undefined : en.auth.verifyEmail.missingTokenMessage
  );
  // Tracks the last token submitted to the API. Prevents React StrictMode's
  // double-invocation of effects from burning a one-time-use verification token.
  const submittedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    if (submittedTokenRef.current === token) return;

    submittedTokenRef.current = token;

    verifyEmail({ token })
      .then(() => {
        setStatus("success");
      })
      .catch((err: unknown) => {
        setStatus("error");
        const msg = getApiErrorMessage(err);
        setErrorMessage(
          msg === en.common.somethingWentWrong ? en.auth.verifyEmail.expiredOrInvalidMessage : msg
        );
      });
  }, [token]);

  return { status, errorMessage };
}
