"use client";

import { useEffect, useMemo, useRef } from "react";
import * as Cesium from "cesium";
import { toCartesian3, telemetryToCartesianPositions } from "@/lib/cesiumCoordinates";
import type { CollisionRisk, OrbitData, RiskBand } from "@/types";

interface SceneManagerOptions {
  viewer: Cesium.Viewer | null;
  satellites: OrbitData[];
  collisionEvents: CollisionRisk[];
  currentTimeIso: string;
  selectedEntityId: string | null;
}

interface SatelliteRenderCache {
  signature: string;
  sampledPosition: Cesium.SampledPositionProperty;
  orbitPath: Cesium.Cartesian3[];
}

function riskColor(riskBand: RiskBand) {
  if (riskBand === "critical") return Cesium.Color.RED;
  if (riskBand === "high") return Cesium.Color.fromCssColorString("#ff7c8d");
  if (riskBand === "moderate") return Cesium.Color.fromCssColorString("#ffd173");
  return Cesium.Color.fromCssColorString("#35f2d1");
}

function makeTelemetrySignature(orbit: OrbitData) {
  const first = orbit.telemetry[0]?.timestampIso ?? "";
  const last = orbit.telemetry[orbit.telemetry.length - 1]?.timestampIso ?? "";
  return `${orbit.telemetry.length}:${first}:${last}`;
}

function buildSampledPosition(track: OrbitData["telemetry"]) {
  const sampled = new Cesium.SampledPositionProperty();
  sampled.setInterpolationOptions({
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    interpolationDegree: 2
  });

  track.forEach((sample) => {
    sampled.addSample(
      Cesium.JulianDate.fromDate(new Date(sample.timestampIso)),
      toCartesian3(Cesium, sample)
    );
  });
  return sampled;
}

function toOrbitMaterial(selected: boolean) {
  const color = selected
    ? Cesium.Color.fromCssColorString("#35f2d1").withAlpha(0.95)
    : Cesium.Color.fromCssColorString("#6a7f95").withAlpha(0.3);
  return new Cesium.ColorMaterialProperty(color);
}

function toPointColor(selected: boolean) {
  return selected ? Cesium.Color.fromCssColorString("#7ef9e8") : Cesium.Color.WHITE;
}

function shouldRenderCollision(event: CollisionRisk, selectedEntityId: string | null) {
  if (selectedEntityId) {
    return event.primaryObjectId === selectedEntityId || event.secondaryObjectId === selectedEntityId;
  }
  return event.riskBand === "critical" || event.riskBand === "high" || event.riskBand === "moderate";
}

export function useSceneManager({
  viewer,
  satellites,
  collisionEvents,
  currentTimeIso,
  selectedEntityId
}: SceneManagerOptions) {
  const satelliteEntityIds = useRef<Set<string>>(new Set());
  const collisionEntityIds = useRef<Set<string>>(new Set());
  const satelliteCache = useRef<Map<string, SatelliteRenderCache>>(new Map());

  const currentTime = useMemo(() => Cesium.JulianDate.fromDate(new Date(currentTimeIso)), [currentTimeIso]);

  useEffect(() => {
    if (!viewer) return;

    const nextSatelliteIds = new Set<string>();

    satellites.forEach((satellite) => {
      if (satellite.telemetry.length === 0) return;

      const id = `satellite:${satellite.id}`;
      const signature = makeTelemetrySignature(satellite);
      const cacheKey = satellite.id;
      const selected = selectedEntityId === satellite.id;
      nextSatelliteIds.add(id);

      let cache = satelliteCache.current.get(cacheKey);
      if (!cache || cache.signature !== signature) {
        cache = {
          signature,
          sampledPosition: buildSampledPosition(satellite.telemetry),
          orbitPath: telemetryToCartesianPositions(Cesium, satellite.telemetry)
        };
        satelliteCache.current.set(cacheKey, cache);
      }

      const existing = viewer.entities.getById(id);
      if (!existing) {
        viewer.entities.add({
          id,
          name: satellite.name,
          position: cache.sampledPosition,
          point: {
            pixelSize: selected ? 10 : 7,
            color: toPointColor(selected),
            outlineWidth: selected ? 2.5 : 1.5,
            outlineColor: Cesium.Color.BLACK
          },
          polyline: {
            positions: cache.orbitPath,
            width: selected ? 3.2 : 1.3,
            material: toOrbitMaterial(selected)
          },
          label: {
            show: selected,
            text: satellite.id,
            font: "13px sans-serif",
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
            pixelOffset: new Cesium.Cartesian2(9, -12)
          }
        });
      } else {
        existing.position = cache.sampledPosition;
        if (existing.polyline) {
          existing.polyline.positions = new Cesium.ConstantProperty(cache.orbitPath);
          existing.polyline.material = toOrbitMaterial(selected);
          existing.polyline.width = new Cesium.ConstantProperty(selected ? 3.2 : 1.3);
        }
        if (existing.point) {
          existing.point.pixelSize = new Cesium.ConstantProperty(selected ? 10 : 7);
          existing.point.color = new Cesium.ConstantProperty(toPointColor(selected));
          existing.point.outlineWidth = new Cesium.ConstantProperty(selected ? 2.5 : 1.5);
        }
        if (existing.label) {
          existing.label.show = new Cesium.ConstantProperty(selected);
        }
      }
    });

    satelliteEntityIds.current.forEach((id) => {
      if (!nextSatelliteIds.has(id)) {
        viewer.entities.removeById(id);
      }
    });
    satelliteEntityIds.current = nextSatelliteIds;
  }, [viewer, satellites, selectedEntityId]);

  useEffect(() => {
    if (!viewer) return;

    const nextCollisionIds = new Set<string>();

    const visibleEvents = collisionEvents
      .filter((event) => shouldRenderCollision(event, selectedEntityId))
      .slice(0, selectedEntityId ? 20 : 8);

    visibleEvents.forEach((event) => {
      const lineId = `collision-line:${event.id}`;
      nextCollisionIds.add(lineId);

      const primaryEntity = viewer.entities.getById(`satellite:${event.primaryObjectId}`);
      const secondaryEntity = viewer.entities.getById(`satellite:${event.secondaryObjectId}`);
      if (!primaryEntity?.position || !secondaryEntity?.position) return;

      const start = primaryEntity.position.getValue(currentTime);
      const end = secondaryEntity.position.getValue(currentTime);
      if (!start || !end) return;

      const color = riskColor(event.riskBand);
      const existing = viewer.entities.getById(lineId);
      if (!existing) {
        viewer.entities.add({
          id: lineId,
          polyline: {
            positions: [start, end],
            width: 2.2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              taperPower: 0.8,
              color: color.withAlpha(0.8)
            })
          }
        });
      } else if (existing.polyline) {
        existing.polyline.positions = new Cesium.ConstantProperty([start, end]);
      }
    });

    collisionEntityIds.current.forEach((id) => {
      if (!nextCollisionIds.has(id)) {
        viewer.entities.removeById(id);
      }
    });
    collisionEntityIds.current = nextCollisionIds;
  }, [viewer, collisionEvents, selectedEntityId, currentTime]);
}
