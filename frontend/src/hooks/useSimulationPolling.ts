"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { buildWebSocketUrl } from "@/lib/env";
import { fetchMissionSnapshot, fetchMlStatus, fetchPredictions } from "@/services/simulationService";
import { useSimulationStore } from "@/store/useSimulationStore";

export function useSimulationPolling() {
  const setMissionSnapshot = useSimulationStore((state) => state.setMissionSnapshot);
  const applyPredictions = useSimulationStore((state) => state.applyPredictions);
  const setConnectionState = useSimulationStore((state) => state.setConnectionState);
  const setMetrics = useSimulationStore((state) => state.setMetrics);
  const setMlStatus = useSimulationStore((state) => state.setMlStatus);

  const snapshotQuery = useQuery({
    queryKey: ["mission", "snapshot"],
    queryFn: fetchMissionSnapshot,
    refetchInterval: 12_000
  });

  const predictionsQuery = useQuery({
    queryKey: ["mission", "predictions"],
    queryFn: fetchPredictions,
    refetchInterval: 10_000
  });

  const mlStatusQuery = useQuery({
    queryKey: ["mission", "ml-status"],
    queryFn: fetchMlStatus,
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (snapshotQuery.data) {
      setMissionSnapshot(snapshotQuery.data);
    }
  }, [snapshotQuery.data, setMissionSnapshot]);

  useEffect(() => {
    if (predictionsQuery.data && predictionsQuery.data.length > 0) {
      applyPredictions(predictionsQuery.data);
    }
  }, [predictionsQuery.data, applyPredictions]);

  useEffect(() => {
    if (mlStatusQuery.data !== undefined) {
      setMlStatus(mlStatusQuery.data);
    }
  }, [mlStatusQuery.data, setMlStatus]);

  useEffect(() => {
    const hasSnapshot = snapshotQuery.data !== undefined;
    const isInitialLoad = !hasSnapshot && (snapshotQuery.isLoading || snapshotQuery.isFetching);
    const hasPredictions = predictionsQuery.data !== undefined;
    const hasMlStatus = mlStatusQuery.data !== undefined;

    if (isInitialLoad) {
      setConnectionState("connecting");
      return;
    }

    if (snapshotQuery.isError) {
      setConnectionState("offline");
      return;
    }

    if (
      predictionsQuery.isError ||
      mlStatusQuery.isError ||
      (predictionsQuery.isFetching && !hasPredictions) ||
      (mlStatusQuery.isFetching && !hasMlStatus) ||
      (snapshotQuery.isFetching && !hasSnapshot)
    ) {
      setConnectionState("degraded");
      return;
    }

    setConnectionState("online");
  }, [
    snapshotQuery.data,
    snapshotQuery.isLoading,
    snapshotQuery.isError,
    snapshotQuery.isFetching,
    predictionsQuery.data,
    predictionsQuery.isLoading,
    predictionsQuery.isError,
    predictionsQuery.isFetching,
    mlStatusQuery.data,
    mlStatusQuery.isError,
    mlStatusQuery.isFetching,
    setConnectionState
  ]);

  useEffect(() => {
    const token = getAuthToken();
    let isMounted = true;
    let socket: WebSocket | null = null;
    let endpoint = "";

    try {
      const parsedUrl = new URL(buildWebSocketUrl("/ws/system-status"));
      if (token) {
        parsedUrl.searchParams.set("token", token);
      }
      endpoint = parsedUrl.toString();
    } catch {
      setMetrics({ wsConnected: false });
      return;
    }

    try {
      socket = new WebSocket(endpoint);
    } catch {
      setMetrics({ wsConnected: false });
      return;
    }

    socket.onopen = () => {
      if (!isMounted) return;
      setMetrics({ wsConnected: true });
    };
    socket.onerror = () => {
      if (!isMounted) return;
      setMetrics({ wsConnected: false });
    };
    socket.onclose = () => {
      if (!isMounted) return;
      setMetrics({ wsConnected: false });
    };

    return () => {
      isMounted = false;
      socket?.close();
    };
  }, [setMetrics]);
}
