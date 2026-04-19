"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary captured:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-red-400/40 bg-cosmic-900/90 p-6">
        <p className="text-xs uppercase tracking-[0.12em] text-red-300">System Fault</p>
        <h1 className="mt-2 font-[var(--font-sans)] text-2xl font-bold text-red-100">
          Mission Control Panel encountered an unrecoverable error
        </h1>
        <p className="mt-3 text-sm text-red-100/85">{error.message}</p>
        <Button className="mt-5" onClick={reset}>
          Retry Render
        </Button>
      </div>
    </main>
  );
}
