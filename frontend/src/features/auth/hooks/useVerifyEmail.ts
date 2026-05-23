import { useState, useEffect } from "react";
import { verifyEmail } from "../api/authApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import type { VerifyEmailStatus } from "../types/emailVerification.types";

export function useVerifyEmail(token: string | null) {
  const [status, setStatus] = useState<VerifyEmailStatus>(() => (token ? "verifying" : "error"));
  const [errorMessage, setErrorMessage] = useState<string | undefined>(() =>
    token ? undefined : en.auth.verifyEmail.missingTokenMessage
  );

  useEffect(() => {
    if (!token) return;

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
