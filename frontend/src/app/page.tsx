"use client";

import { CesiumWrapper } from "@/components/cesium/CesiumWrapper";
import { CollisionAlerts } from "@/components/dashboard/CollisionAlerts";
import { SystemStatus } from "@/components/dashboard/SystemStatus";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { TimelineScrubber } from "@/components/dashboard/TimelineScrubber";
import { useSimulationPolling } from "@/hooks/useSimulationPolling";

export default function MissionControlPage() {
  useSimulationPolling();

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <CesiumWrapper />

      <aside className="absolute left-4 top-4 z-20 flex h-[calc(100vh-120px)] w-[360px] flex-col gap-3">
        <TelemetryPanel />
        <div className="min-h-0 flex-1">
          <CollisionAlerts />
        </div>
      </aside>

      <div className="absolute right-4 top-4 z-20 w-[320px]">
        <SystemStatus />
      </div>

      <div className="absolute bottom-4 left-1/2 z-20 w-[min(860px,92vw)] -translate-x-1/2">
        <TimelineScrubber />
      </div>
    </main>
  );
}
