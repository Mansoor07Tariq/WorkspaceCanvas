import { type FormEvent, useEffect, useRef, useState } from "react";
import { confirmMfa, setupMfa } from "../api/authApi";

export type MfaSetupStep = "loading" | "scan" | "codes" | "error";

interface MfaSetupState {
  step: MfaSetupStep;
  qrCodeBase64: string;
  provisioningUri: string;
  token: string;
  tokenError: string;
  recoveryCodes: string[];
  generalError: string;
  loading: boolean;
  setToken: (value: string) => void;
  handleConfirm: (e: FormEvent) => void;
}

export function useMfaSetup(): MfaSetupState {
  const [step, setStep] = useState<MfaSetupStep>("loading");
  const [qrCodeBase64, setQrCodeBase64] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

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
        setGeneralError("Failed to initialize MFA setup. Please try again.");
        setStep("error");
      });
  }, []);

  function handleConfirm(e: FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setTokenError("Enter your authenticator code.");
      return;
    }
    if (!/^\d{6}$/.test(trimmed)) {
      setTokenError("Enter a valid 6-digit code.");
      return;
    }
    setTokenError("");
    setLoading(true);
    confirmMfa({ token: trimmed })
      .then((resp) => {
        setRecoveryCodes(resp.recovery_codes);
        setStep("codes");
      })
      .catch(() => {
        setGeneralError(
          "Verification failed. Make sure your device clock is correct and try again."
        );
      })
      .finally(() => setLoading(false));
  }

  return {
    step,
    qrCodeBase64,
    provisioningUri,
    token,
    tokenError,
    recoveryCodes,
    generalError,
    loading,
    setToken,
    handleConfirm,
  };
}
