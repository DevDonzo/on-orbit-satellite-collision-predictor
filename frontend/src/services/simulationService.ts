import type {
  BackendCollisionDto,
  BackendSatelliteDto,
  CollisionRisk,
  OrbitData,
  RiskBand,
  TelemetrySample
} from "@/types";
import { HttpError, apiRequest } from "@/services/apiClient";
import { mockCollisionEvents, mockSatellites } from "@/services/mockData";

const MAX_HISTORY_POINTS = 720;
const DENSIFY_SUBDIVISIONS = 4;
const telemetryHistoryBySatelliteId = new Map<string, TelemetrySample[]>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapBackendRiskToBand(risk: BackendSatelliteDto["risk"] | BackendCollisionDto["risk"]): RiskBand {
  if (risk === "danger") return "critical";
  if (risk === "warning") return "moderate";
  return "low";
}

function deriveProbabilityFromMissDistance(missDistanceKm: number): number {
  if (missDistanceKm <= 0) return 1;
  const score = 1 - missDistanceKm / 50;
  return Number(clamp(score, 0, 1).toFixed(4));
}

function appendTelemetrySample(satelliteId: string, sample: TelemetrySample): TelemetrySample[] {
  const existing = telemetryHistoryBySatelliteId.get(satelliteId) ?? [];
  const last = existing[existing.length - 1];
  if (!last || last.timestampIso !== sample.timestampIso) {
    existing.push(sample);
  } else {
    existing[existing.length - 1] = sample;
  }
  const trimmed = existing.slice(-MAX_HISTORY_POINTS);
  telemetryHistoryBySatelliteId.set(satelliteId, trimmed);
  return trimmed;
}

function interpolateTelemetry(left: TelemetrySample, right: TelemetrySample, t: number): TelemetrySample {
  return {
    timestampIso: new Date(
      new Date(left.timestampIso).getTime() + (new Date(right.timestampIso).getTime() - new Date(left.timestampIso).getTime()) * t
    ).toISOString(),
    latitudeDeg: left.latitudeDeg + (right.latitudeDeg - left.latitudeDeg) * t,
    longitudeDeg: left.longitudeDeg + (right.longitudeDeg - left.longitudeDeg) * t,
    altitudeKm: left.altitudeKm + (right.altitudeKm - left.altitudeKm) * t,
    velocityKms: left.velocityKms + (right.velocityKms - left.velocityKms) * t
  };
}

function densifyTelemetry(track: TelemetrySample[]): TelemetrySample[] {
  if (track.length < 2) return track;
  const out: TelemetrySample[] = [];
  for (let i = 0; i < track.length - 1; i += 1) {
    const left = track[i];
    const right = track[i + 1];
    out.push(left);
    for (let step = 1; step < DENSIFY_SUBDIVISIONS; step += 1) {
      out.push(interpolateTelemetry(left, right, step / DENSIFY_SUBDIVISIONS));
    }
  }
  out.push(track[track.length - 1]);
  return out;
}

function backendSatelliteToOrbitData(dto: BackendSatelliteDto, sampleTimeIso: string): OrbitData {
  const sample: TelemetrySample = {
    timestampIso: sampleTimeIso,
    latitudeDeg: Number(dto.lat),
    longitudeDeg: Number(dto.lon),
    altitudeKm: Number(dto.alt_km),
    velocityKms: 7.67
  };
  const history = appendTelemetrySample(dto.name, sample);
  const status: OrbitData["status"] = dto.risk === "danger" ? "maneuvering" : "active";
  return {
    id: dto.name,
    name: dto.name,
    noradId: "N/A",
    status,
    updatedAtIso: sampleTimeIso,
    telemetry: densifyTelemetry(history)
  };
}

export async function fetchSatellites(): Promise<OrbitData[]> {
  const sampledAtIso = new Date().toISOString();
  try {
    const response = await apiRequest<BackendSatelliteDto[]>("/satellites", {
      method: "GET",
      requiresAuth: false
    });
    return response.map((satellite) => backendSatelliteToOrbitData(satellite, sampledAtIso));
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ENABLE_SIMULATION_MOCKS === "true" && error instanceof HttpError) {
      return mockSatellites;
    }
    throw error;
  }
}

export async function fetchCollisionEvents(): Promise<CollisionRisk[]> {
  try {
    const response = await apiRequest<BackendCollisionDto[]>("/collisions", {
      method: "GET",
      requiresAuth: false
    });
    return response.map((event) => ({
      id: `${event.satellite_1}:${event.satellite_2}:${event.timestamp}`,
      primaryObjectId: event.satellite_1,
      secondaryObjectId: event.satellite_2,
      probability: deriveProbabilityFromMissDistance(Number(event.distance_km)),
      riskBand: mapBackendRiskToBand(event.risk),
      missDistanceKm: Number(event.distance_km),
      relativeVelocityKms: 0,
      timeOfClosestApproachIso: new Date(event.timestamp).toISOString(),
      riskZoneRadiusKm: clamp(Number(event.distance_km) * 0.5, 8, 75)
    }));
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ENABLE_SIMULATION_MOCKS === "true" && error instanceof HttpError) {
      return mockCollisionEvents;
    }
    throw error;
  }
}
