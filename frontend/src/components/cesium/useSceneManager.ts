"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { toCartesian3, telemetryToCartesianPositions } from "@/lib/cesiumCoordinates";
import type { CollisionRisk, OrbitData } from "@/types";

interface SceneManagerOptions {
  viewer: Cesium.Viewer | null;
  satellites: OrbitData[];
  collisionEvents: CollisionRisk[];
}

function colorForRisk(riskBand: CollisionRisk["riskBand"]) {
  if (riskBand === "critical") return Cesium.Color.RED;
  if (riskBand === "high") return Cesium.Color.fromCssColorString("#ff7c8d");
  if (riskBand === "moderate") return Cesium.Color.fromCssColorString("#ffd173");
  return Cesium.Color.fromCssColorString("#35f2d1");
}

export function useSceneManager({ viewer, satellites, collisionEvents }: SceneManagerOptions) {
  const satelliteEntityIds = useRef<Set<string>>(new Set());
  const collisionEntityIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!viewer) return;

    const nextSatelliteIds = new Set<string>();
    satellites.forEach((satellite) => {
      if (satellite.telemetry.length === 0) return;

      const id = `satellite:${satellite.id}`;
      nextSatelliteIds.add(id);
      const telemetryPositions = telemetryToCartesianPositions(Cesium, satellite.telemetry);
      const lastTelemetry = satellite.telemetry[satellite.telemetry.length - 1];
      const existing = viewer.entities.getById(id);

      if (!existing) {
        viewer.entities.add({
          id,
          name: satellite.id,
          polyline: {
            positions: telemetryPositions,
            width: 2.4,
            material: Cesium.Color.CYAN.withAlpha(0.84)
          },
          position: toCartesian3(Cesium, lastTelemetry),
          point: {
            pixelSize: 8,
            color: Cesium.Color.WHITE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK
          },
          label: {
            text: satellite.id,
            font: "13px sans-serif",
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.65),
            pixelOffset: new Cesium.Cartesian2(8, -10)
          }
        });
      } else {
        if (existing.polyline) {
          existing.polyline.positions = new Cesium.ConstantProperty(telemetryPositions);
        }
        existing.position = new Cesium.ConstantPositionProperty(toCartesian3(Cesium, lastTelemetry));
      }
    });

    satelliteEntityIds.current.forEach((id) => {
      if (!nextSatelliteIds.has(id)) {
        viewer.entities.removeById(id);
      }
    });
    satelliteEntityIds.current = nextSatelliteIds;
  }, [viewer, satellites]);

  useEffect(() => {
    if (!viewer) return;

    const nextCollisionIds = new Set<string>();

    collisionEvents.forEach((event) => {
      const lineId = `collision-line:${event.id}`;
      const zoneId = `collision-zone:${event.id}`;
      const boxId = `collision-box:${event.id}`;
      nextCollisionIds.add(lineId);
      nextCollisionIds.add(zoneId);
      nextCollisionIds.add(boxId);

      const start = toCartesian3(Cesium, event.vectorStart);
      const end = toCartesian3(Cesium, event.vectorEnd);
      const center = Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3());
      const color = colorForRisk(event.riskBand);

      if (!viewer.entities.getById(lineId)) {
        viewer.entities.add({
          id: lineId,
          polyline: {
            positions: [start, end],
            width: 4,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              color
            })
          }
        });
      } else {
        const entity = viewer.entities.getById(lineId);
        if (entity?.polyline) {
          entity.polyline.positions = new Cesium.ConstantProperty([start, end]);
        }
      }

      if (!viewer.entities.getById(zoneId)) {
        viewer.entities.add({
          id: zoneId,
          position: center,
          ellipsoid: {
            radii: new Cesium.Cartesian3(
              event.riskZoneRadiusKm * 1000,
              event.riskZoneRadiusKm * 1000,
              event.riskZoneRadiusKm * 500
            ),
            material: color.withAlpha(0.14),
            outline: true,
            outlineColor: color.withAlpha(0.6)
          }
        });
      }

      if (!viewer.entities.getById(boxId)) {
        viewer.entities.add({
          id: boxId,
          position: center,
          box: {
            dimensions: new Cesium.Cartesian3(
              event.missDistanceKm * 1400,
              event.missDistanceKm * 1400,
              event.missDistanceKm * 1400
            ),
            material: color.withAlpha(0.2),
            outline: true,
            outlineColor: color.withAlpha(0.8)
          }
        });
      }
    });

    collisionEntityIds.current.forEach((id) => {
      if (!nextCollisionIds.has(id)) {
        viewer.entities.removeById(id);
      }
    });
    collisionEntityIds.current = nextCollisionIds;
  }, [viewer, collisionEvents]);
}
