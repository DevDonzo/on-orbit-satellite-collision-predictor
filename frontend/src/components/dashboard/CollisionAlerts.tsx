"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSimulationStore } from "@/store/useSimulationStore";
import type { CollisionRisk, RiskBand } from "@/types";

const riskOrder: Record<RiskBand, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1
};

function sortEventsDescending(left: CollisionRisk, right: CollisionRisk) {
  const byRisk = riskOrder[right.riskBand] - riskOrder[left.riskBand];
  if (byRisk !== 0) return byRisk;
  return right.probability - left.probability;
}

export function CollisionAlerts() {
  const collisionEvents = useSimulationStore((state) => state.collisionEvents);
  const setSelectedEntityId = useSimulationStore((state) => state.setSelectedEntityId);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return collisionEvents
      .filter((event) =>
        normalized.length === 0
          ? true
          : `${event.primaryObjectId} ${event.secondaryObjectId}`.toLowerCase().includes(normalized)
      )
      .sort(sortEventsDescending);
  }, [collisionEvents, query]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <AlertTriangle className="h-4 w-4 text-neon-coral" />
          Collision Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by satellite ID"
          aria-label="Search collision events"
        />
        <div className="max-h-[350px] space-y-2 overflow-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-300/80">No events found.</p>
          ) : (
            filtered.map((event) => (
              <button
                key={event.id}
                className="w-full rounded-xl border border-slate-700 bg-cosmic-950/70 p-3 text-left transition hover:border-neon-violet/70"
                onClick={() => setSelectedEntityId(event.primaryObjectId)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">
                    {event.primaryObjectId} vs {event.secondaryObjectId}
                  </p>
                  <Badge variant={event.riskBand}>{event.riskBand}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-300/80">
                  Probability {(event.probability * 100).toFixed(2)}% · Miss Distance {event.missDistanceKm.toFixed(2)} km
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  TCA {new Date(event.timeOfClosestApproachIso).toISOString()}
                </p>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
