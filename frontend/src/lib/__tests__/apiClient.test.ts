import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, apiRequest, ApiError } from "../api/apiClient";

vi.mock("../../config/env", () => ({
  API_BASE_URL: "http://localhost:8000",
}));

// vi.hoisted ensures this is created before the factory below runs (vi.mock is hoisted).
const mockGetToken = vi.hoisted(() =>
  vi.fn<() => string | null>().mockReturnValue("stored-access-token")
);

vi.mock("../tokenStorage", () => ({
  tokenStorage: {
    getAccessToken: mockGetToken,
  },
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
    expect(await api.post("/api/auth/logout/", { refresh: "tok" })).toBeUndefined();
  });
});
