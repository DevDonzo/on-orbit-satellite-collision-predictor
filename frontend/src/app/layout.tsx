import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "@/app/globals.css";
import "cesium/Build/Cesium/Widgets/widgets.css";

const display = Sora({ subsets: ["latin"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "On-Orbit Collision Predictor",
  description: "Mission-control frontend for orbital conjunction prediction."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-[var(--font-body)] mission-backdrop`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
