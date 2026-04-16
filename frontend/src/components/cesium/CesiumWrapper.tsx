"use client";

import dynamic from "next/dynamic";

const CesiumViewer = dynamic(() => import("@/components/cesium/CesiumViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-cosmic-950/70">
      <p className="text-sm text-slate-200">Bootstrapping Cesium scene...</p>
    </div>
  )
});

export function CesiumWrapper() {
  return <CesiumViewer />;
}
