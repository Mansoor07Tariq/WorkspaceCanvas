export const en = {
  auth: {
    fields: {
      fullName: "Full name",
      fullNamePlaceholder: "Jane Smith",
      email: "Email",
      emailPlaceholder: "jane@example.com",
      password: "Password",
      confirmPassword: "Confirm password",
    },
    login: {
      title: "Sign in to your account",
      subtitle: "Welcome back. Enter your details to continue.",
      submit: "Sign in",
      noAccount: "Don't have an account?",
      createAccount: "Create one",
      signedInTitle: "You're signed in",
      signedInMessage: "This placeholder will become the WorkspaceCanvas dashboard.",
      mfaRequiredTitle: "MFA verification required",
      mfaRequiredMessage:
        "We received your MFA challenge. The verification screen will be added next.",
    },
    signup: {
      title: "Create your account",
      subtitle: "We'll send a verification link to your email.",
      submit: "Create account",
      alreadyHaveAccount: "Already have an account?",
      signIn: "Sign in",
      successTitle: "Check your email",
      successMessage: "We sent a verification link to",
      verificationRequired: "You need to verify your email before you can sign in.",
      backToSignIn: "Back to sign in",
    },
    validation: {
      fullNameMaxLength: "Full name must be 255 characters or fewer.",
      emailRequired: "Email is required.",
      invalidEmail: "Enter a valid email address.",
      passwordRequired: "Password is required.",
      passwordMinLength: "Password must be at least 8 characters.",
      confirmPasswordRequired: "Please confirm your password.",
      passwordMismatch: "Passwords do not match.",
    },
  },
  common: {
    somethingWentWrong: "Something went wrong. Please try again.",
  },
} as const;
