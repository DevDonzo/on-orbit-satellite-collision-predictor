import type { TleOrbitalElements } from "@/types";

function ensureTleLineLength(line: string) {
  if (line.length < 63) {
    throw new Error("Invalid TLE line length; expected at least 63 characters.");
  }
}

export function parseTle(line1: string, line2: string): TleOrbitalElements {
  ensureTleLineLength(line1);
  ensureTleLineLength(line2);
  if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) {
    throw new Error("Invalid TLE format; expected line numbers 1 and 2.");
  }

  const eccentricity = Number(`0.${line2.slice(26, 33).trim()}`);
  const inclinationDeg = Number(line2.slice(8, 16).trim());
  const raanDeg = Number(line2.slice(17, 25).trim());
  const argPerigeeDeg = Number(line2.slice(34, 42).trim());
  const meanAnomalyDeg = Number(line2.slice(43, 51).trim());
  const meanMotionRevPerDay = Number(line2.slice(52, 63).trim());

  return {
    line1,
    line2,
    inclinationDeg,
    raanDeg,
    eccentricity,
    argPerigeeDeg,
    meanAnomalyDeg,
    meanMotionRevPerDay
  };
}
