import type { GeodeticPoint, TelemetrySample } from "@/types";

type CesiumModule = typeof import("cesium");

export function toCartesian3(Cesium: CesiumModule, point: GeodeticPoint) {
  return Cesium.Cartesian3.fromDegrees(point.longitudeDeg, point.latitudeDeg, point.altitudeKm * 1000);
}

export function telemetryToCartesianPositions(Cesium: CesiumModule, telemetry: TelemetrySample[]) {
  return telemetry.map((sample) => toCartesian3(Cesium, sample));
}
