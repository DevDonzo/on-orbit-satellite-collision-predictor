"use client";

import { CesiumWrapper } from "@/components/cesium/CesiumWrapper";
import { CollisionAlerts } from "@/components/dashboard/CollisionAlerts";
import { MissionOverview } from "@/components/dashboard/MissionOverview";
import { SystemStatus } from "@/components/dashboard/SystemStatus";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { TimelineScrubber } from "@/components/dashboard/TimelineScrubber";
import { useSimulationPolling } from "@/hooks/useSimulationPolling";
import { useSimulationStore } from "@/store/useSimulationStore";

export default function MissionControlPage() {
  useSimulationPolling();

  const metrics = useSimulationStore((state) => state.metrics);
  const connectionState = useSimulationStore((state) => state.connectionState);
  const propagationMode = useSimulationStore((state) => state.propagationMode);
  const mlStatus = useSimulationStore((state) => state.mlStatus);
  const satellites = useSimulationStore((state) => state.satellites);
  const collisionEvents = useSimulationStore((state) => state.collisionEvents);
  const selectedEntityId = useSimulationStore((state) => state.selectedEntityId);
  const selectedCollisionId = useSimulationStore((state) => state.selectedCollisionId);

  const selectedSatellite =
    (selectedEntityId && satellites[selectedEntityId]) || Object.values(satellites)[0] || null;
  const selectedCollision =
    collisionEvents.find((event) => event.id === selectedCollisionId) || collisionEvents[0] || null;

  return (
    <main className="relative min-h-screen bg-cosmic-950">
      <section className="relative isolate h-[100svh] min-h-[760px] overflow-hidden border-b border-white/10">
        <CesiumWrapper />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(5,9,20,0),rgba(5,9,20,0.68))]" />
        <div className="pointer-events-none absolute inset-0 z-10 grid-overlay opacity-35" />
        <div className="mission-scan pointer-events-none absolute inset-0 z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-[linear-gradient(180deg,rgba(5,9,20,0),rgba(5,9,20,0.86))]" />

        <div className="relative z-20 flex h-full flex-col justify-between p-4 md:p-6">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="hero-panel pointer-events-auto max-w-3xl">
              <p className="section-kicker">Orbital Command</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[0.08em] text-white md:text-4xl">
                On-Orbit Collision Predictor
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/82 md:text-base">
                Tactical visualization, conjunction scoring, and machine-learning-backed distance forecasting for a live
                orbital catalog. The globe stays live in view while the command deck scrolls below it.
              </p>
            </div>

            <div className="pointer-events-auto grid gap-2 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-1">
              <div className="hero-stat-row">
                <span className="metric-chip__label">Renderer</span>
                <span className="telemetry-value">{metrics.fps.toFixed(1)} FPS</span>
              </div>
              <div className="hero-stat-row">
                <span className="metric-chip__label">Alerts</span>
                <span className="telemetry-value">{metrics.activeAlertCount.toString().padStart(2, "0")}</span>
              </div>
              <div className="hero-stat-row">
                <span className="metric-chip__label">Link</span>
                <span className="inline-flex items-center gap-2">
                  <span className={`status-dot status-dot--${connectionState}`} />
                  <span className="telemetry-value capitalize">{connectionState}</span>
                </span>
              </div>
              <div className="hero-stat-row">
                <span className="metric-chip__label">ML Route</span>
                <span className="telemetry-value">{mlStatus?.selectedModel ?? mlStatus?.source ?? "pending"}</span>
              </div>
            </div>
          </header>

          <div className="grid items-end gap-4 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
            <div className="hero-panel pointer-events-auto max-w-3xl">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="section-kicker">Selected Asset</p>
                  <p className="mt-2 text-lg font-semibold text-white">{selectedSatellite?.name ?? "Awaiting track"}</p>
                  <p className="telemetry-value mt-1 text-sm text-slate-300/80">
                    {selectedSatellite ? `NORAD ${selectedSatellite.noradId}` : "No object selected"}
                  </p>
                </div>
                <div>
                  <p className="section-kicker">Propagation</p>
                  <p className="telemetry-value mt-2 text-lg font-semibold text-white">{propagationMode}</p>
                  <p className="mt-1 text-sm text-slate-300/80">
                    {selectedSatellite
                      ? `${selectedSatellite.orbitalPeriodMinutes.toFixed(1)} min orbital period`
                      : "Waiting for orbital solution"}
                  </p>
                </div>
                <div>
                  <p className="section-kicker">Lead Threat</p>
                  <p className="telemetry-value mt-2 text-lg font-semibold text-white">
                    {selectedCollision ? `${(selectedCollision.probability * 100).toFixed(1)}%` : "--"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300/80">
                    {selectedCollision
                      ? `${selectedCollision.missDistanceKm.toFixed(2)} km miss in ${Math.round(selectedCollision.leadTimeMinutes)} min`
                      : "No active conjunction"}
                  </p>
                </div>
              </div>
            </div>

            <div className="hero-panel pointer-events-auto">
              <p className="section-kicker">Scene Guidance</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300/82">
                <li>Drag to orbit the camera around the Earth.</li>
                <li>Scroll or pinch to zoom toward selected assets.</li>
                <li>Select an alert or asset below to reframe the scene.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-16 px-4 pb-8 md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_25rem]">
            <MissionOverview />
            <SystemStatus />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <TelemetryPanel />
            <CollisionAlerts />
          </div>

          <TimelineScrubber />
        </div>
      </section>
    </main>
  );
}
