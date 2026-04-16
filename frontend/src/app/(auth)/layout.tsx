import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-cosmic-900/90 p-7">{children}</section>
    </main>
  );
}
