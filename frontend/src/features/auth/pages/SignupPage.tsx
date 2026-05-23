import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { signup } from "../api/authApi";
import { getApiErrorMessage } from "../../../lib/api/getApiErrorMessage";
import { validateSignupForm, validatePasswordConfirmation } from "../utils/signupValidation";
import { extractSignupFieldErrors } from "../utils/authErrorUtils";
import type { SignupFieldErrors } from "../types/signup.types";
import { en } from "../../../i18n/en";
import { AuthLayout } from "../components/AuthLayout";
import { AuthCard } from "../components/AuthCard";
import { AuthTextField } from "../components/AuthTextField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { AuthSubmitButton } from "../components/AuthSubmitButton";

export function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [generalError, setGeneralError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors = validateSignupForm(fullName, email, password);
    const confirmErr = validatePasswordConfirmation(password, confirmPassword);
    if (confirmErr) errors.confirmPassword = confirmErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setGeneralError(undefined);
    setLoading(true);

    try {
      await signup({
        email,
        password,
        ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
      });
      setSubmittedEmail(email);
      setSuccess(true);
    } catch (err) {
      const fieldErrs = extractSignupFieldErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setFieldErrors(fieldErrs);
      } else {
        setGeneralError(getApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{en.auth.signup.successTitle}</h1>
            <p className="text-sm text-slate-600">
              {en.auth.signup.successMessage}{" "}
              <span className="font-medium text-slate-800">{submittedEmail}</span>.
            </p>
            <p className="text-sm text-slate-500">{en.auth.signup.verificationRequired}</p>
            <Link
              to="/login"
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {en.auth.signup.backToSignIn}
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <div className="mb-6 text-center">
          <p className="text-2xl font-black text-blue-600">WorkspaceCanvas</p>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">{en.auth.signup.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{en.auth.signup.subtitle}</p>
        </div>

        {generalError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <AuthTextField
            id="full-name"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.full_name}
            disabled={loading}
            autoComplete="name"
            placeholder="Jane Smith"
          />
          <AuthTextField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={loading}
            autoComplete="email"
            placeholder="jane@example.com"
          />
          <AuthPasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            disabled={loading}
            autoComplete="new-password"
          />
          <AuthPasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={loading}
            autoComplete="new-password"
          />
          <AuthSubmitButton label={en.auth.signup.submit} loading={loading} />
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {en.auth.signup.alreadyHaveAccount}{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            {en.auth.signup.signIn}
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
