const API_OVERRIDE_STORAGE_KEY = "scp.api.base-url";

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:8000";
  if (typeof window === "undefined") {
    return configured.replace(/\/+$/, "");
  }
  return (localStorage.getItem(API_OVERRIDE_STORAGE_KEY) || configured).replace(/\/+$/, "");
}

export function setApiBaseUrl(baseUrl: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_OVERRIDE_STORAGE_KEY, baseUrl.replace(/\/+$/, ""));
}
