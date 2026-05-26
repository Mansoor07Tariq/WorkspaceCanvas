import { useEffect, useRef, useState } from "react";
import { confirmMfa, setupMfa } from "../api/authApi";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { en } from "@/i18n/en";

export type MfaSetupStep = "loading" | "scan" | "codes" | "error";

interface MfaSetupState {
  step: MfaSetupStep;
  qrCodeBase64: string;
  provisioningUri: string;
  token: string;
  tokenError: string;
  recoveryCodes: string[];
  generalError: string | undefined;
  loading: boolean;
  setToken: (value: string) => void;
  handleConfirm: (e: { preventDefault(): void }) => void;
}

export function useMfaSetup(): MfaSetupState {
  const { submission, startSubmission, setGeneralError, endSubmission } = useFormSubmission();
  const [step, setStep] = useState<MfaSetupStep>("loading");
  const [qrCodeBase64, setQrCodeBase64] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const initialized = useRef(false);

  const c = en.auth.mfaSetup;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setupMfa()
      .then((resp) => {
        setQrCodeBase64(resp.qr_code_base64);
        setProvisioningUri(resp.provisioning_uri);
        setStep("scan");
      })
      .catch(() => {
        setGeneralError(c.setupInitError);
        setStep("error");
      });
    // c is a module-level constant — intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm(e: { preventDefault(): void }) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setTokenError(c.invalidCodeRequired);
      return;
    }
    if (!/^\d{6}$/.test(trimmed)) {
      setTokenError(c.invalidCodeFormat);
      return;
    }
    setTokenError("");
    startSubmission();
    confirmMfa({ token: trimmed })
      .then((resp) => {
        setRecoveryCodes(resp.recovery_codes);
        setStep("codes");
      })
      .catch(() => {
        setGeneralError(c.setupVerificationError);
      })
      .finally(() => endSubmission());
  }

  return {
    step,
    qrCodeBase64,
    provisioningUri,
    token,
    tokenError,
    recoveryCodes,
    generalError: submission.generalError,
    loading: submission.loading,
    setToken,
    handleConfirm,
  };
}
