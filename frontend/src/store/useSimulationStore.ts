import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import type { ApiConnectionState, CollisionRisk, OrbitData, SystemMetrics } from "@/types";

interface SimulationState {
  currentTimeIso: string;
  satellites: Record<string, OrbitData>;
  collisionEvents: CollisionRisk[];
  selectedEntityId: string | null;
  connectionState: ApiConnectionState;
  metrics: SystemMetrics;
}

interface SimulationActions {
  setCurrentTimeIso: (timeIso: string) => void;
  upsertSatellites: (satellites: OrbitData[]) => void;
  setCollisionEvents: (events: CollisionRisk[]) => void;
  setSelectedEntityId: (entityId: string | null) => void;
  setConnectionState: (state: ApiConnectionState) => void;
  setMetrics: (partial: Partial<SystemMetrics>) => void;
  reset: () => void;
}

type SimulationStore = SimulationState & SimulationActions;

const defaultState: SimulationState = {
  currentTimeIso: new Date().toISOString(),
  satellites: {},
  collisionEvents: [],
  selectedEntityId: null,
  connectionState: "connecting",
  metrics: {
    fps: 0,
    apiLatencyMs: 0,
    trackedObjectCount: 0
  }
};

export const useSimulationStore = create<SimulationStore>()(
  subscribeWithSelector(
    devtools(
      (set) => ({
        ...defaultState,
        setCurrentTimeIso: (currentTimeIso) =>
          set(
            () => ({ currentTimeIso }),
            false,
            "simulation/setCurrentTimeIso"
          ),
        upsertSatellites: (satellites) =>
          set(
            (state) => {
              const merged = { ...state.satellites };
              satellites.forEach((satellite) => {
                merged[satellite.id] = satellite;
              });
              return {
                satellites: merged,
                metrics: {
                  ...state.metrics,
                  trackedObjectCount: Object.keys(merged).length
                }
              };
            },
            false,
            "simulation/upsertSatellites"
          ),
        setCollisionEvents: (collisionEvents) =>
          set(
            () => ({ collisionEvents }),
            false,
            "simulation/setCollisionEvents"
          ),
        setSelectedEntityId: (selectedEntityId) =>
          set(
            () => ({ selectedEntityId }),
            false,
            "simulation/setSelectedEntityId"
          ),
        setConnectionState: (connectionState) =>
          set(
            () => ({ connectionState }),
            false,
            "simulation/setConnectionState"
          ),
        setMetrics: (partial) =>
          set(
            (state) => ({
              metrics: { ...state.metrics, ...partial }
            }),
            false,
            "simulation/setMetrics"
          ),
        reset: () =>
          set(
            () => ({ ...defaultState }),
            false,
            "simulation/reset"
          )
      }),
      { name: "simulation-store" }
    )
  )
);
