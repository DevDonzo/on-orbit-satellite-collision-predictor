export type RiskBand = "low" | "moderate" | "high" | "critical";
export type ApiConnectionState = "connecting" | "online" | "degraded" | "offline";

export interface GeodeticPoint {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
}

export interface TelemetrySample extends GeodeticPoint {
  timestampIso: string;
  velocityKms: number;
}

export interface TleOrbitalElements {
  line1: string;
  line2: string;
  inclinationDeg: number;
  raanDeg: number;
  eccentricity: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
}

export interface OrbitData {
  id: string;
  name: string;
  noradId: string;
  telemetry: TelemetrySample[];
  tle?: TleOrbitalElements;
  status: "active" | "inactive" | "maneuvering";
  updatedAtIso: string;
}

export interface CollisionRisk {
  id: string;
  primaryObjectId: string;
  secondaryObjectId: string;
  probability: number;
  riskBand: RiskBand;
  missDistanceKm: number;
  relativeVelocityKms: number;
  timeOfClosestApproachIso: string;
  vectorStart: GeodeticPoint;
  vectorEnd: GeodeticPoint;
  riskZoneRadiusKm: number;
}

export interface TelemetryApiResponse {
  satellites: OrbitData[];
  serverTimeIso: string;
}

export interface CollisionApiResponse {
  events: CollisionRisk[];
  serverTimeIso: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
}

export interface PredictionReport {
  id: string;
  primaryObjectId: string;
  secondaryObjectId: string;
  probability: number;
  riskBand: RiskBand;
  generatedAtIso: string;
}

export interface SystemMetrics {
  fps: number;
  apiLatencyMs: number;
  trackedObjectCount: number;
}
