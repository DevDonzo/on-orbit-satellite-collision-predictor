import type { CollisionRisk, OrbitData, TelemetrySample } from "@/types";

function telemetryTrack(
  seedLongitude: number,
  seedLatitude: number,
  altitudeKm: number,
  steps = 44
): TelemetrySample[] {
  return Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    return {
      timestampIso: new Date(Date.now() + index * 90_000).toISOString(),
      latitudeDeg: seedLatitude + Math.sin(t * Math.PI * 2) * 8.5,
      longitudeDeg: seedLongitude + t * 40,
      altitudeKm: altitudeKm + Math.cos(t * Math.PI * 2) * 6,
      velocityKms: 7.2 + Math.sin(t * 4) * 0.1
    };
  });
}

export const mockSatellites: OrbitData[] = [
  {
    id: "SAT-ALPHA",
    name: "Aster Alpha",
    noradId: "44973",
    status: "active",
    updatedAtIso: new Date().toISOString(),
    telemetry: telemetryTrack(-103, 12, 692)
  },
  {
    id: "SAT-BETA",
    name: "Aster Beta",
    noradId: "44974",
    status: "active",
    updatedAtIso: new Date().toISOString(),
    telemetry: telemetryTrack(-88, 18, 699)
  },
  {
    id: "SAT-GAMMA",
    name: "Aster Gamma",
    noradId: "44975",
    status: "maneuvering",
    updatedAtIso: new Date().toISOString(),
    telemetry: telemetryTrack(-120, 8, 705)
  }
];

export const mockCollisionEvents: CollisionRisk[] = [
  {
    id: "EVT-2026-0416-001",
    primaryObjectId: "SAT-ALPHA",
    secondaryObjectId: "SAT-BETA",
    probability: 0.82,
    riskBand: "critical",
    missDistanceKm: 0.44,
    relativeVelocityKms: 12.8,
    timeOfClosestApproachIso: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
    vectorStart: { latitudeDeg: 19.5, longitudeDeg: -73.2, altitudeKm: 696 },
    vectorEnd: { latitudeDeg: 20.4, longitudeDeg: -71.4, altitudeKm: 697 },
    riskZoneRadiusKm: 110
  },
  {
    id: "EVT-2026-0416-002",
    primaryObjectId: "SAT-GAMMA",
    secondaryObjectId: "SAT-BETA",
    probability: 0.38,
    riskBand: "moderate",
    missDistanceKm: 2.9,
    relativeVelocityKms: 10.7,
    timeOfClosestApproachIso: new Date(Date.now() + 48 * 60 * 1000).toISOString(),
    vectorStart: { latitudeDeg: 5.2, longitudeDeg: -39.8, altitudeKm: 704 },
    vectorEnd: { latitudeDeg: 5.7, longitudeDeg: -38.1, altitudeKm: 703 },
    riskZoneRadiusKm: 75
  }
];
