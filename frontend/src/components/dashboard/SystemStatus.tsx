"use client";

import { Activity, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimulationStore } from "@/store/useSimulationStore";

function mapStateToBadgeVariant(state: ReturnType<typeof useSimulationStore.getState>["connectionState"]) {
  if (state === "online") return "low" as const;
  if (state === "degraded") return "moderate" as const;
  if (state === "offline") return "critical" as const;
  return "neutral" as const;
}

export function SystemStatus() {
  const connectionState = useSimulationStore((state) => state.connectionState);
  const metrics = useSimulationStore((state) => state.metrics);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-100">System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-neon-cyan" />
            Connection
          </span>
          <Badge variant={mapStateToBadgeVariant(connectionState)}>{connectionState}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Cpu className="h-4 w-4 text-neon-amber" />
            Renderer FPS
          </span>
          <span>{metrics.fps.toFixed(1)}</span>
        </div>
        <div className="text-xs text-slate-300/80">Telemetry API latency: {metrics.apiLatencyMs} ms</div>
      </CardContent>
    </Card>
  );
}
