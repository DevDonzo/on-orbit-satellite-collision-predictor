"use client";

import { useMemo } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimulationStore } from "@/store/useSimulationStore";

const WINDOW_MS = 4 * 60 * 60 * 1000;

export function TimelineScrubber() {
  const currentTimeIso = useSimulationStore((state) => state.currentTimeIso);
  const satellites = useSimulationStore((state) => state.satellites);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const playbackRate = useSimulationStore((state) => state.playbackRate);
  const setCurrentTimeIso = useSimulationStore((state) => state.setCurrentTimeIso);
  const setIsPlaying = useSimulationStore((state) => state.setIsPlaying);
  const setPlaybackRate = useSimulationStore((state) => state.setPlaybackRate);

  const [startMs, endMs] = useMemo(() => {
    const telemetryTimes = Object.values(satellites)
      .flatMap((satellite) => satellite.telemetry.map((sample) => new Date(sample.timestampIso).getTime()))
      .filter((value) => Number.isFinite(value));
    if (telemetryTimes.length === 0) {
      const now = Date.now();
      return [now - WINDOW_MS / 2, now + WINDOW_MS / 2];
    }
    const min = Math.min(...telemetryTimes);
    const max = Math.max(...telemetryTimes);
    const padding = Math.max(10 * 60 * 1000, (max - min) * 0.2);
    return [min - padding, max + padding];
  }, [satellites]);

  const currentMs = new Date(currentTimeIso).getTime();
  const safeCurrentMs = Number.isFinite(currentMs) ? Math.min(endMs, Math.max(startMs, currentMs)) : startMs;

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-100">Simulation Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-8 px-3"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <label className="text-xs text-slate-300/85">
            Speed
            <select
              className="ml-2 rounded-md border border-slate-700 bg-cosmic-950 px-2 py-1 text-xs text-slate-200"
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
            >
              {[1, 10, 30, 60, 120].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          type="range"
          min={startMs}
          max={endMs}
          step={1_000}
          value={safeCurrentMs}
          onChange={(event) => {
            setIsPlaying(false);
            setCurrentTimeIso(new Date(Number(event.target.value)).toISOString());
          }}
          className="w-full accent-cyan-300"
          aria-label="Simulation timeline scrubber"
        />
        <p className="text-xs text-slate-300/85">Current simulation time: {new Date(safeCurrentMs).toISOString()}</p>
      </CardContent>
    </Card>
  );
}
