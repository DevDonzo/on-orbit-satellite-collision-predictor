"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCollisionEvents, fetchSatellites } from "@/services/simulationService";
import { useSimulationStore } from "@/store/useSimulationStore";

export function useSimulationPolling() {
  const upsertSatellites = useSimulationStore((state) => state.upsertSatellites);
  const setCollisionEvents = useSimulationStore((state) => state.setCollisionEvents);
  const setConnectionState = useSimulationStore((state) => state.setConnectionState);
  const setMetrics = useSimulationStore((state) => state.setMetrics);

  const telemetryQuery = useQuery({
    queryKey: ["simulation", "telemetry"],
    queryFn: fetchSatellites,
    refetchInterval: 12_000
  });

  const collisionQuery = useQuery({
    queryKey: ["simulation", "collisions"],
    queryFn: fetchCollisionEvents,
    refetchInterval: 10_000
  });

  useEffect(() => {
    const startedAt = performance.now();
    if (telemetryQuery.data) {
      upsertSatellites(telemetryQuery.data);
      setMetrics({
        apiLatencyMs: Math.max(0, Math.round(performance.now() - startedAt))
      });
    }
  }, [telemetryQuery.data, upsertSatellites, setMetrics]);

  useEffect(() => {
    if (collisionQuery.data) {
      setCollisionEvents(collisionQuery.data);
    }
  }, [collisionQuery.data, setCollisionEvents]);

  useEffect(() => {
    if (telemetryQuery.isLoading || collisionQuery.isLoading) {
      setConnectionState("connecting");
      return;
    }
    if (telemetryQuery.isError || collisionQuery.isError) {
      setConnectionState("offline");
      return;
    }
    if (telemetryQuery.isFetching || collisionQuery.isFetching) {
      setConnectionState("degraded");
      return;
    }
    setConnectionState("online");
  }, [
    telemetryQuery.isLoading,
    telemetryQuery.isError,
    telemetryQuery.isFetching,
    collisionQuery.isLoading,
    collisionQuery.isError,
    collisionQuery.isFetching,
    setConnectionState
  ]);
}
