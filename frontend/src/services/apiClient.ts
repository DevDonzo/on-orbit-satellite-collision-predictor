import { getAuthToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/env";

export class HttpError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
  requiresAuth?: boolean;
};

function normalizeBody(body: ApiRequestOptions["body"]) {
  if (!body) return undefined;
  if (body instanceof FormData || body instanceof URLSearchParams || typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

export async function apiRequest<TResponse>(
  endpoint: string,
  { body, requiresAuth = false, headers, ...init }: ApiRequestOptions = {}
): Promise<TResponse> {
  const token = getAuthToken();
  if (requiresAuth && !token) {
    throw new HttpError("JWT token missing. Please log in.", 401, null);
  }

  const requestHeaders = new Headers(headers ?? {});
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (requiresAuth && token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...init,
    headers: requestHeaders,
    body: normalizeBody(body)
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const parsed = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : `Request failed (${response.status})`;
    throw new HttpError(detail, response.status, parsed);
  }

  return parsed as TResponse;
}
