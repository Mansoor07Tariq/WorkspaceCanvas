export type ResendVerificationFieldErrors = {
  email?: string;
};

export type VerifyEmailStatus = "idle" | "verifying" | "success" | "error";
