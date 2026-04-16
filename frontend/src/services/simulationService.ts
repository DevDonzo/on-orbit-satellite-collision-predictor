import type {
  BackendCollisionSummary,
  BackendPredictionSummary,
  BackendSatelliteSummary,
  CollisionRisk,
  OrbitData,
  RiskBand,
  TelemetrySample
} from "@/types";
import { HttpError, apiRequest } from "@/services/apiClient";
import { mockCollisionEvents, mockSatellites } from "@/services/mockData";

function normalizeRisk(risk: "safe" | "warning" | "danger"): RiskBand {
  if (risk === "danger") return "critical";
  if (risk === "warning") return "high";
  return "low";
}

function defaultProbabilityFromRisk(riskBand: RiskBand): number {
  if (riskBand === "critical") return 0.86;
  if (riskBand === "high") return 0.64;
  if (riskBand === "moderate") return 0.41;
  return 0.12;
}

function makeSyntheticOrbitTrack(lat: number, lon: number, altKm: number, steps = 36): TelemetrySample[] {
  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / (steps - 1);
    return {
      timestampIso: new Date(Date.now() + index * 60_000).toISOString(),
      latitudeDeg: lat + Math.sin(ratio * Math.PI * 2) * 4.2,
      longitudeDeg: lon + ratio * 22.0,
      altitudeKm: altKm + Math.cos(ratio * Math.PI * 2) * 2.8,
      velocityKms: 7.3
    };
  });
}

function mapSatelliteSummary(summary: BackendSatelliteSummary): OrbitData {
  return {
    id: summary.name,
    name: summary.name,
    noradId: "N/A",
    telemetry: makeSyntheticOrbitTrack(summary.lat, summary.lon, summary.alt_km),
    status: "active",
    updatedAtIso: new Date().toISOString()
  };
}

export async function fetchSatellites(): Promise<OrbitData[]> {
  try {
    const response = await apiRequest<BackendSatelliteSummary[]>("/satellites", {
      method: "GET",
      requiresAuth: false
    });
    return response.map(mapSatelliteSummary);
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 503)) {
      return mockSatellites;
    }
    throw error;
  }
}

export async function fetchCollisionEvents(): Promise<CollisionRisk[]> {
  try {
    const [collisions, predictions, satellites] = await Promise.all([
      apiRequest<BackendCollisionSummary[]>("/collisions", {
        method: "GET",
        requiresAuth: false
      }),
      apiRequest<BackendPredictionSummary[]>("/predict", {
        method: "GET",
        requiresAuth: false
      }).catch((error: unknown) => {
        if (error instanceof HttpError && error.status === 503) {
          return [];
        }
        throw error;
      }),
      apiRequest<BackendSatelliteSummary[]>("/satellites", {
        method: "GET",
        requiresAuth: false
      })
    ]);

    const satelliteByName = new Map(satellites.map((satellite) => [satellite.name, satellite]));
    const predictionByPair = new Map(
      predictions.map((prediction) => [`${prediction.satellite_1}|${prediction.satellite_2}`, prediction] as const)
    );

    return collisions.map((collision, index) => {
      const prediction =
        predictionByPair.get(`${collision.satellite_1}|${collision.satellite_2}`) ??
        predictionByPair.get(`${collision.satellite_2}|${collision.satellite_1}`);
      const primary = satelliteByName.get(collision.satellite_1);
      const secondary = satelliteByName.get(collision.satellite_2);
      const fallbackLat = 0.0 + index;
      const fallbackLon = 0.0 + index;

      const riskBand = normalizeRisk(prediction?.predicted_risk ?? collision.risk);
      const missDistance = prediction?.predicted_min_distance_km ?? collision.distance_km;

      return {
        id: `collision-${collision.satellite_1}-${collision.satellite_2}-${index}`,
        primaryObjectId: collision.satellite_1,
        secondaryObjectId: collision.satellite_2,
        probability: defaultProbabilityFromRisk(riskBand),
        riskBand,
        missDistanceKm: missDistance,
        relativeVelocityKms: 7.8,
        timeOfClosestApproachIso: new Date(collision.timestamp).toISOString(),
        vectorStart: {
          latitudeDeg: primary?.lat ?? fallbackLat,
          longitudeDeg: primary?.lon ?? fallbackLon,
          altitudeKm: primary?.alt_km ?? 700
        },
        vectorEnd: {
          latitudeDeg: secondary?.lat ?? fallbackLat + 0.4,
          longitudeDeg: secondary?.lon ?? fallbackLon + 0.7,
          altitudeKm: secondary?.alt_km ?? 702
        },
        riskZoneRadiusKm: Math.max(20, Math.min(120, missDistance * 7))
      } satisfies CollisionRisk;
    });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 503)) {
      return mockCollisionEvents;
    }
    throw error;
  }
}
