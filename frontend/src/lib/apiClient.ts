export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown) {
    super(`API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const { headers: extraHeaders, ...restOptions } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders as Record<string, string>),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
