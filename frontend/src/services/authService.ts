import { setAuthToken } from "@/lib/auth";
import type { AuthTokenResponse, LoginPayload, RegisterPayload } from "@/types";
import { HttpError, apiRequest } from "@/services/apiClient";

export async function login(payload: LoginPayload) {
  const body = new URLSearchParams({
    username: payload.username,
    password: payload.password
  });
  const response = await apiRequest<AuthTokenResponse>("/auth/token", {
    method: "POST",
    body,
    requiresAuth: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  setAuthToken(response.access_token);
  return response;
}

export async function register(payload: RegisterPayload) {
  try {
    await apiRequest<{ username: string }>("/auth/register", {
      method: "POST",
      body: payload,
      requiresAuth: false
    });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new Error(
        "Registration endpoint is not available on the backend yet. Ask backend to add /auth/register."
      );
    }
    throw error;
  }
}
