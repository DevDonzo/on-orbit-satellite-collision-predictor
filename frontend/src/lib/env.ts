const API_OVERRIDE_STORAGE_KEY = "scp.api.base-url";
const DEFAULT_API_BASE_URL = "http://localhost:8000";

function normalizeBaseUrl(baseUrl: string | null | undefined): string | null {
  const trimmed = (baseUrl ?? "").trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function getApiBaseUrl() {
  const configured = normalizeBaseUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL) ?? DEFAULT_API_BASE_URL;
  if (typeof window === "undefined") {
    return configured;
  }

  const override = normalizeBaseUrl(localStorage.getItem(API_OVERRIDE_STORAGE_KEY));
  return override ?? configured;
}

export function buildWebSocketUrl(pathname: string) {
  const url = new URL(getApiBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  url.search = "";
  return url.toString();
}

export function setApiBaseUrl(baseUrl: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    localStorage.removeItem(API_OVERRIDE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(API_OVERRIDE_STORAGE_KEY, normalized);
}

export type GlobeImageryMode = "arcgis" | "cesium-ion" | "osm";

export function getGlobeImageryMode(): GlobeImageryMode {
  const rawMode = (process.env.NEXT_PUBLIC_GLOBE_IMAGERY_MODE ?? "arcgis").toLowerCase();
  if (rawMode === "cesium-ion") return "cesium-ion";
  if (rawMode === "osm") return "osm";
  return "arcgis";
}

export function getCesiumIonToken(): string | null {
  const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

export function getArcGisToken(): string | null {
  const token = process.env.NEXT_PUBLIC_ARCGIS_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}
