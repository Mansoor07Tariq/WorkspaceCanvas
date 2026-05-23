import { describe, it, expect } from "vitest";
import { extractSignupFieldErrors, extractLoginFieldErrors } from "../utils/authErrorUtils";
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
