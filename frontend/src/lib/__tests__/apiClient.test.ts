import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, apiRequest, ApiError } from "@/lib/api/apiClient";

vi.mock("@/config/env", () => ({
  API_BASE_URL: "http://localhost:8000",
}));

const mockGetToken = vi.hoisted(() =>
  vi.fn<() => string | null>().mockReturnValue("stored-access-token")
);

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccessToken: mockGetToken,
    setAccessToken: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

const mockEmitSessionExpired = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sessionEvents", () => ({
  sessionEvents: {
    emitSessionExpired: mockEmitSessionExpired,
    onSessionExpired: vi.fn(),
  },
}));

const mockRefreshStoredTokens = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock("@/features/auth/utils/sessionRefresh", () => ({
  refreshStoredTokens: mockRefreshStoredTokens,
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("apiRequest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("constructs the full URL from API_BASE_URL and path", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await apiRequest("/api/auth/me/");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/me/",
      expect.any(Object)
    );
  });

  it("returns parsed JSON on 200", async () => {
    const body = { access: "abc", refresh: "xyz" };
    fetchMock.mockResolvedValueOnce(makeResponse(200, body));
    expect(await apiRequest<typeof body>("/api/auth/token/")).toEqual(body);
  });

  it("returns undefined on 204", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(204, null));
    expect(await apiRequest<void>("/api/auth/logout/")).toBeUndefined();
  });

  it("throws ApiError on non-OK response", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(400, { detail: "Bad" }));
    await expect(apiRequest("/api/auth/token/")).rejects.toThrow(ApiError);
  });

  it("ApiError carries the HTTP status and parsed body", async () => {
    const body = { detail: "Not found." };
    fetchMock.mockResolvedValueOnce(makeResponse(404, body));
    try {
      await apiRequest("/api/auth/me/");
    } catch (err) {
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).data).toEqual(body);
      expect((err as ApiError).name).toBe("ApiError");
    }
  });

  it("ApiError.data is null when response body is not valid JSON", async () => {
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

describe("api.get", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockGetToken.mockReturnValue("stored-access-token");
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("attaches Authorization header by default (auth: true)", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/auth/me/");
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: "Bearer stored-access-token",
    });
  });

  it("does not attach Authorization header when auth: false", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/auth/me/", { auth: false });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("does not attach Authorization header when stored token is null", async () => {
    mockGetToken.mockReturnValueOnce(null);
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/auth/me/");
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("merges caller-provided headers", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/auth/me/", { headers: { "X-Custom": "value" } });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({ "X-Custom": "value" });
  });
});

describe("api.post", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockGetToken.mockReturnValue("stored-access-token");
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("sends POST method", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.post("/api/auth/token/", { email: "a@b.com" }, { auth: false });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).method).toBe("POST");
  });

  it("automatically stringifies body to JSON", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    const body = { email: "a@b.com", password: "pass" };
    await api.post("/api/auth/token/", body, { auth: false });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).body).toBe(JSON.stringify(body));
  });

  it("sets Content-Type: application/json when body is provided", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.post("/api/auth/token/", { email: "a@b.com" }, { auth: false });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    });
  });

  it("does not set Content-Type when no body is provided", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.post("/api/auth/mfa/setup/");
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).not.toHaveProperty("Content-Type");
  });

  it("attaches Authorization header by default", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.post("/api/auth/mfa/confirm/", { token: "123456" });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: "Bearer stored-access-token",
    });
  });

  it("skips Authorization header when auth: false", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    await api.post("/api/auth/token/", { email: "a@b.com" }, { auth: false });
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("returns undefined on 204", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(204, null));
    expect(await api.post("/api/auth/logout/")).toBeUndefined();
  });
});

describe("api — 401 retry", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.clearAllMocks();
    mockGetToken.mockReturnValue("old-access-token");
  });

  it("refreshes tokens and retries once when an authenticated request returns 401", async () => {
    mockRefreshStoredTokens.mockResolvedValueOnce(true);
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { detail: "Expired." }))
      .mockResolvedValueOnce(makeResponse(200, { id: 1 }));

    const result = await api.get<{ id: number }>("/api/auth/me/");

    expect(mockRefreshStoredTokens).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 1 });
  });

  it("uses the new access token on the retry request", async () => {
    mockRefreshStoredTokens.mockResolvedValueOnce(true);
    mockGetToken.mockReturnValueOnce("old-access-token").mockReturnValueOnce("new-access-token");
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { detail: "Expired." }))
      .mockResolvedValueOnce(makeResponse(200, {}));

    await api.get("/api/auth/me/");

    const [, retryOptions] = fetchMock.mock.calls[1];
    expect((retryOptions as RequestInit).headers).toMatchObject({
      Authorization: "Bearer new-access-token",
    });
  });

  it("emits session expired and throws when refresh fails", async () => {
    mockRefreshStoredTokens.mockResolvedValueOnce(false);
    fetchMock.mockResolvedValueOnce(makeResponse(401, { detail: "Expired." }));

    await expect(api.get("/api/auth/me/")).rejects.toThrow(ApiError);
    expect(mockEmitSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("does not retry and does not refresh for public auth endpoints (auth: false)", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(401, { detail: "Bad credentials." }));

    await expect(
      api.post("/api/auth/token/", { email: "a@b.com" }, { auth: false })
    ).rejects.toThrow(ApiError);

    expect(mockRefreshStoredTokens).not.toHaveBeenCalled();
    expect(mockEmitSessionExpired).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry the token refresh endpoint itself", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(401, { detail: "Refresh expired." }));

    await expect(api.post("/api/auth/token/refresh/", undefined, { auth: false })).rejects.toThrow(
      ApiError
    );

    expect(mockRefreshStoredTokens).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry the login endpoint", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(401, { detail: "Bad credentials." }));

    await expect(
      api.post("/api/auth/token/", { email: "a@b.com", password: "bad" }, { auth: false })
    ).rejects.toThrow(ApiError);

    expect(mockRefreshStoredTokens).not.toHaveBeenCalled();
  });

  it("does not retry the logout endpoint — logout is best-effort", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(401, { detail: "Expired." }));

    await expect(api.post("/api/auth/logout/")).rejects.toThrow(ApiError);

    expect(mockRefreshStoredTokens).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("emits session expired and rethrows if retry also returns 401", async () => {
    mockRefreshStoredTokens.mockResolvedValueOnce(true);
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { detail: "Expired." }))
      .mockResolvedValueOnce(makeResponse(401, { detail: "Still expired." }));

    await expect(api.get("/api/auth/me/")).rejects.toThrow(ApiError);
    expect(mockEmitSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on non-401 errors", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500, { detail: "Server error." }));

    await expect(api.get("/api/auth/me/")).rejects.toThrow(ApiError);
    expect(mockRefreshStoredTokens).not.toHaveBeenCalled();
  });
});
