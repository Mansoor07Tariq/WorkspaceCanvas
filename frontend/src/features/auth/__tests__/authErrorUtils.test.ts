import { describe, it, expect } from "vitest";
import {
  extractSignupFieldErrors,
  extractLoginFieldErrors,
  extractMfaChallengeFieldErrors,
  extractResendVerificationFieldErrors,
} from "../utils/authErrorUtils";
import { ApiError } from "@/lib/api/apiError";

describe("extractSignupFieldErrors", () => {
  it("extracts email error from ApiError", () => {
    const err = new ApiError(400, { email: ["This email is already registered."] });
    expect(extractSignupFieldErrors(err).email).toBe("This email is already registered.");
  });

  it("extracts password error from ApiError", () => {
    const err = new ApiError(400, { password: ["This password is too short."] });
    expect(extractSignupFieldErrors(err).password).toBe("This password is too short.");
  });

  it("extracts full_name error from ApiError", () => {
    const err = new ApiError(400, {
      full_name: ["Ensure this field has no more than 255 characters."],
    });
    expect(extractSignupFieldErrors(err).full_name).toBe(
      "Ensure this field has no more than 255 characters."
    );
  });

  it("returns empty object for a non-ApiError", () => {
    expect(extractSignupFieldErrors(new Error("network failure"))).toEqual({});
  });

  it("returns empty object when ApiError data is not an object", () => {
    expect(extractSignupFieldErrors(new ApiError(500, "internal error"))).toEqual({});
  });

  it("returns empty object when ApiError data is null", () => {
    expect(extractSignupFieldErrors(new ApiError(500, null))).toEqual({});
  });

  it("takes only the first error when a field has multiple", () => {
    const err = new ApiError(400, { email: ["Error one.", "Error two."] });
    expect(extractSignupFieldErrors(err).email).toBe("Error one.");
  });
});

describe("extractLoginFieldErrors", () => {
  it("extracts email error from ApiError", () => {
    const err = new ApiError(400, { email: ["No account found with this email."] });
    expect(extractLoginFieldErrors(err).email).toBe("No account found with this email.");
  });

  it("extracts password error from ApiError", () => {
    const err = new ApiError(400, { password: ["Incorrect password."] });
    expect(extractLoginFieldErrors(err).password).toBe("Incorrect password.");
  });

  it("extracts both email and password errors", () => {
    const err = new ApiError(400, {
      email: ["No account found."],
      password: ["Incorrect password."],
    });
    const result = extractLoginFieldErrors(err);
    expect(result.email).toBe("No account found.");
    expect(result.password).toBe("Incorrect password.");
  });

  it("returns empty object for a non-ApiError", () => {
    expect(extractLoginFieldErrors(new Error("network failure"))).toEqual({});
  });

  it("returns empty object when ApiError data is not an object", () => {
    expect(extractLoginFieldErrors(new ApiError(500, "internal error"))).toEqual({});
  });

  it("returns empty object when ApiError data is null", () => {
    expect(extractLoginFieldErrors(new ApiError(500, null))).toEqual({});
  });

  it("takes only the first error when a field has multiple", () => {
    const err = new ApiError(400, { email: ["Error one.", "Error two."] });
    expect(extractLoginFieldErrors(err).email).toBe("Error one.");
  });
});

describe("extractMfaChallengeFieldErrors", () => {
  it("extracts token error from ApiError", () => {
    const err = new ApiError(400, { token: ["Invalid or expired token."] });
    expect(extractMfaChallengeFieldErrors(err).token).toBe("Invalid or expired token.");
  });

  it("extracts recovery_code error from ApiError", () => {
    const err = new ApiError(400, { recovery_code: ["Invalid recovery code."] });
    expect(extractMfaChallengeFieldErrors(err).recovery_code).toBe("Invalid recovery code.");
  });

  it("extracts both token and recovery_code errors", () => {
    const err = new ApiError(400, {
      token: ["Invalid token."],
      recovery_code: ["Invalid recovery code."],
    });
    const result = extractMfaChallengeFieldErrors(err);
    expect(result.token).toBe("Invalid token.");
    expect(result.recovery_code).toBe("Invalid recovery code.");
  });

  it("returns empty object for a non-ApiError", () => {
    expect(extractMfaChallengeFieldErrors(new Error("network failure"))).toEqual({});
  });

  it("returns empty object when ApiError data is not an object", () => {
    expect(extractMfaChallengeFieldErrors(new ApiError(500, "internal error"))).toEqual({});
  });

  it("returns empty object when ApiError data is null", () => {
    expect(extractMfaChallengeFieldErrors(new ApiError(500, null))).toEqual({});
  });

  it("returns empty object when no matching fields are present", () => {
    const err = new ApiError(400, { detail: "MFA challenge expired." });
    expect(extractMfaChallengeFieldErrors(err)).toEqual({});
  });
});

describe("extractResendVerificationFieldErrors", () => {
  it("extracts email error from ApiError", () => {
    const err = new ApiError(400, { email: ["Enter a valid email address."] });
    expect(extractResendVerificationFieldErrors(err).email).toBe("Enter a valid email address.");
  });

  it("returns empty object for a non-ApiError", () => {
    expect(extractResendVerificationFieldErrors(new Error("network failure"))).toEqual({});
  });

  it("returns empty object when ApiError data is not an object", () => {
    expect(extractResendVerificationFieldErrors(new ApiError(500, "internal error"))).toEqual({});
  });

  it("returns empty object when ApiError data is null", () => {
    expect(extractResendVerificationFieldErrors(new ApiError(500, null))).toEqual({});
  });

  it("returns empty object when no matching fields are present", () => {
    const err = new ApiError(400, { detail: "Something went wrong." });
    expect(extractResendVerificationFieldErrors(err)).toEqual({});
  });
});
