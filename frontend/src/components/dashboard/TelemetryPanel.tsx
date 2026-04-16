"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSimulationStore } from "@/store/useSimulationStore";

export function TelemetryPanel() {
  const satellites = useSimulationStore((state) => state.satellites);
  const selectedEntityId = useSimulationStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useSimulationStore((state) => state.setSelectedEntityId);
  const [query, setQuery] = useState("");

  const sortedSatellites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return Object.values(satellites)
      .filter((satellite) =>
        normalized.length === 0
          ? true
          : `${satellite.id} ${satellite.name} ${satellite.noradId}`.toLowerCase().includes(normalized)
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  }, [satellites, query]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-slate-100">Tracked Objects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search object ID / NORAD"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search tracked objects"
          />
        </div>
        <div className="max-h-[300px] space-y-2 overflow-auto pr-1">
          {sortedSatellites.map((satellite) => (
            <button
              key={satellite.id}
              onClick={() => setSelectedEntityId(satellite.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selectedEntityId === satellite.id
                  ? "border-neon-cyan bg-cosmic-800/70"
                  : "border-slate-700 bg-cosmic-950/70 hover:border-neon-violet/60"
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{satellite.id}</p>
              <p className="text-xs text-slate-300/80">{satellite.name}</p>
              <p className="text-[11px] text-slate-400">NORAD {satellite.noradId}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
