"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Cesium from "cesium";
import { useSceneManager } from "@/components/cesium/useSceneManager";
import { useSimulationStore } from "@/store/useSimulationStore";

type ViewerReadyState = "booting" | "ready" | "error";

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [readyState, setReadyState] = useState<ViewerReadyState>("booting");

  const satellitesMap = useSimulationStore((state) => state.satellites);
  const collisionEvents = useSimulationStore((state) => state.collisionEvents);
  const selectedEntityId = useSimulationStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useSimulationStore((state) => state.setSelectedEntityId);
  const currentTimeIso = useSimulationStore((state) => state.currentTimeIso);
  const setCurrentTimeIso = useSimulationStore((state) => state.setCurrentTimeIso);
  const setMetrics = useSimulationStore((state) => state.setMetrics);

  const satellites = useMemo(() => Object.values(satellitesMap), [satellitesMap]);

  useSceneManager({
    viewer: viewerRef.current,
    satellites,
    collisionEvents
  });

  useEffect(() => {
    let cancelled = false;
    let onTickDisposer: (() => void) | null = null;
    let postRenderDisposer: (() => void) | null = null;

    async function initializeViewer() {
      try {
        if (typeof window !== "undefined") {
          (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium";
        }
        if (!containerRef.current || cancelled) return;

        const viewer = new Cesium.Viewer(containerRef.current, {
          timeline: false,
          animation: false,
          geocoder: false,
          baseLayerPicker: false,
          sceneModePicker: true,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: true,
          shouldAnimate: true,
          terrain: Cesium.Terrain.fromWorldTerrain()
        });
        viewerRef.current = viewer;
        viewer.scene.globe.enableLighting = true;
        viewer.clock.multiplier = 60;
        setReadyState("ready");

        let lastTickUpdate = 0;
        const onTick = () => {
          const now = performance.now();
          if (now - lastTickUpdate < 250) return;
          lastTickUpdate = now;
          const iso = Cesium.JulianDate.toDate(viewer.clock.currentTime).toISOString();
          setCurrentTimeIso(iso);
        };
        viewer.clock.onTick.addEventListener(onTick);
        onTickDisposer = () => viewer.clock.onTick.removeEventListener(onTick);

        let lastFrameTime = performance.now();
        const postRender = () => {
          const frameNow = performance.now();
          const fps = 1000 / Math.max(1, frameNow - lastFrameTime);
          lastFrameTime = frameNow;
          setMetrics({ fps });
        };
        viewer.scene.postRender.addEventListener(postRender);
        postRenderDisposer = () => viewer.scene.postRender.removeEventListener(postRender);

        viewer.selectedEntityChanged.addEventListener((entity) => {
          const nextId = entity?.id;
          if (typeof nextId === "string" && nextId.startsWith("satellite:")) {
            setSelectedEntityId(nextId.replace("satellite:", ""));
          }
        });
      } catch {
        setReadyState("error");
      }
    }

    initializeViewer();

    return () => {
      cancelled = true;
      onTickDisposer?.();
      postRenderDisposer?.();
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [setCurrentTimeIso, setMetrics, setSelectedEntityId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const targetEntity = selectedEntityId ? viewer.entities.getById(`satellite:${selectedEntityId}`) : null;
    if (targetEntity) {
      viewer.flyTo(targetEntity, { duration: 0.7 }).catch(() => undefined);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const target = Cesium.JulianDate.fromDate(new Date(currentTimeIso));
    const delta = Math.abs(Cesium.JulianDate.secondsDifference(target, viewer.clock.currentTime));
    if (delta > 0.5) {
      viewer.clock.currentTime = target;
    }
  }, [currentTimeIso]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {readyState === "booting" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-cosmic-950/40 text-sm text-slate-200">
          Initializing mission scene...
        </div>
      ) : null}
      {readyState === "error" ? (
        <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded-lg border border-red-400/60 bg-red-500/15 px-3 py-2 text-sm text-red-200">
          Cesium initialization failed. Check browser WebGL support and asset paths.
        </div>
      ) : null}
    </div>
  );
}
