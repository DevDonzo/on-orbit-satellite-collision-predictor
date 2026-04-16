import type { CollisionApiResponse, CollisionRisk, OrbitData, TelemetryApiResponse } from "@/types";
import { HttpError, apiRequest } from "@/services/apiClient";
import { mockCollisionEvents, mockSatellites } from "@/services/mockData";

export async function fetchSatellites(): Promise<OrbitData[]> {
  try {
    const response = await apiRequest<TelemetryApiResponse>("/v1/telemetry/live", {
      method: "GET"
    });
    return response.satellites;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return mockSatellites;
    }
    throw error;
  }
}

export async function fetchCollisionEvents(): Promise<CollisionRisk[]> {
  try {
    const response = await apiRequest<CollisionApiResponse>("/v1/reports/collision-events", {
      method: "GET"
    });
    return response.events;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return mockCollisionEvents;
    }
    throw error;
  }
}
