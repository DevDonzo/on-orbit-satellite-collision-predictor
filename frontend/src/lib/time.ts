export function parseIsoToMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatIsoDateTime(value: string | null | undefined, fallback = "--"): string {
  const parsed = parseIsoToMs(value);
  return parsed === null ? fallback : new Date(parsed).toISOString();
}

export function formatIsoClock(value: string | null | undefined, fallback = "--:--:--"): string {
  const parsed = parseIsoToMs(value);
  return parsed === null ? fallback : new Date(parsed).toISOString().slice(11, 19);
}
