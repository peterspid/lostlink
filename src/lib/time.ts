const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "2 h", "3 days", "40 min" */
export function humanDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MIN))} min`;
  if (abs < DAY) return `${Math.round(abs / HOUR)} h`;
  const d = Math.round(abs / DAY);
  return `${d} day${d === 1 ? "" : "s"}`;
}

export function timeAgo(date: Date | string, now = Date.now()): string {
  const t = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diff = now - t;
  if (diff < MIN) return "just now";
  return `${humanDuration(diff)} ago`;
}

export function formatWhen(from: Date | string, to: Date | string): string {
  const a = new Date(from);
  const b = new Date(to);
  const sameDay = a.toDateString() === b.toDateString();
  const day = a.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const t = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (Math.abs(b.getTime() - a.getTime()) < 5 * MIN) return `${day}, ${t(a)}`;
  if (sameDay) return `${day}, ${t(a)} to ${t(b)}`;
  return `${day} ${t(a)} to ${b.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${t(b)}`;
}

export const DAY_MS = DAY;
export const HOUR_MS = HOUR;
