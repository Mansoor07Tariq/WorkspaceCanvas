import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { apiRequest, ApiError } from "../apiClient";

const BASE_URL = "http://localhost:8000";

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("apiRequest", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeAll(() => {
    vi.stubEnv("VITE_API_BASE_URL", BASE_URL);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("constructs the full URL from base URL and path", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await apiRequest("/api/auth/me/");
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/api/auth/me/`, expect.any(Object));
  });

  it("includes Content-Type: application/json by default", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await apiRequest("/api/auth/me/");
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    });
  });

  it("merges caller-provided headers with the default Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await apiRequest("/api/auth/me/", {
      headers: { Authorization: "Bearer tok" },
    });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer tok",
    });
  });

  it("returns parsed JSON body on 200", async () => {
    const body = { access: "abc", refresh: "xyz" };
    fetchMock.mockResolvedValueOnce(makeResponse(200, body));
    const result = await apiRequest<typeof body>("/api/auth/token/");
    expect(result).toEqual(body);
  });

  it("returns undefined on 204", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(204, null));
    const result = await apiRequest<void>("/api/auth/logout/");
    expect(result).toBeUndefined();
  });

  it("passes method and body through to fetch", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    const payload = JSON.stringify({ email: "a@b.com", password: "pass" });
    await apiRequest("/api/auth/token/", { method: "POST", body: payload });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).method).toBe("POST");
    expect((options as RequestInit).body).toBe(payload);
  });

  it("throws ApiError when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(400, { detail: "Bad request" }));
    await expect(apiRequest("/api/auth/token/")).rejects.toThrow(ApiError);
  });

  it("ApiError carries the HTTP status code", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(401, { detail: "Unauthorized" }));
    try {
      await apiRequest("/api/auth/me/");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
    }
  });

  it("ApiError carries the parsed response body", async () => {
    const errorBody = { detail: "Invalid credentials." };
    fetchMock.mockResolvedValueOnce(makeResponse(400, errorBody));
    try {
      await apiRequest("/api/auth/token/");
    } catch (err) {
      expect((err as ApiError).data).toEqual(errorBody);
    }
  });

  it("ApiError has name 'ApiError'", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(403, {}));
    try {
      await apiRequest("/api/auth/me/");
    } catch (err) {
      expect((err as ApiError).name).toBe("ApiError");
    }
  });

  it("ApiError.data is null when error response body is not valid JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new SyntaxError("not json")),
    } as unknown as Response);
    try {
      await apiRequest("/api/auth/me/");
    } catch (err) {
      expect((err as ApiError).data).toBeNull();
    }
  });
});
