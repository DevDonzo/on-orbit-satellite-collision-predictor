"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimulationStore } from "@/store/useSimulationStore";

const WINDOW_MS = 4 * 60 * 60 * 1000;

export function TimelineScrubber() {
  const currentTimeIso = useSimulationStore((state) => state.currentTimeIso);
  const collisionEvents = useSimulationStore((state) => state.collisionEvents);
  const setCurrentTimeIso = useSimulationStore((state) => state.setCurrentTimeIso);

  const [startMs, endMs] = useMemo(() => {
    if (collisionEvents.length === 0) {
      const now = Date.now();
      return [now - WINDOW_MS / 2, now + WINDOW_MS / 2];
    }
    const eventTimes = collisionEvents.map((event) => new Date(event.timeOfClosestApproachIso).getTime());
    const min = Math.min(...eventTimes);
    const max = Math.max(...eventTimes);
    return [min - 30 * 60 * 1000, max + 30 * 60 * 1000];
  }, [collisionEvents]);

  const currentMs = new Date(currentTimeIso).getTime();
  const safeCurrentMs = Number.isFinite(currentMs) ? currentMs : startMs;

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-100">Simulation Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <input
          type="range"
          min={startMs}
          max={endMs}
          step={30_000}
          value={safeCurrentMs}
          onChange={(event) => setCurrentTimeIso(new Date(Number(event.target.value)).toISOString())}
          className="w-full accent-cyan-300"
          aria-label="Simulation timeline scrubber"
        />
        <p className="text-xs text-slate-300/85">Current simulation time: {new Date(safeCurrentMs).toISOString()}</p>
      </CardContent>
    </Card>
  );
}
