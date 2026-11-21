import { distanceMeters, formatDistance } from "@/lib/geo";
import { humanDuration } from "@/lib/time";
import type { ItemAttributes } from "@/lib/db/schema";

/** Pure matching math, shared by server matching and UI explanations. No I/O. */

export interface MatchSide {
  category: string;
  title: string;
  description: string;
  attributes: ItemAttributes;
  lat: number;
  lng: number;
  occurredFrom: Date | string;
  occurredTo: Date | string;
}

export const MATCH_KEEP_THRESHOLD = 0.42;
export const MATCH_NOTIFY_THRESHOLD = 0.52;
export const MAX_MATCH_RADIUS_M = 30_000;
/** A found item reported up to this long before the loss window starts can still match (clock/user error). */
export const EARLY_TOLERANCE_MS = 12 * 60 * 60 * 1000;

const STOP = new Set(["a", "an", "the", "and", "or", "of", "with", "in", "on", "at", "near", "my", "i", "it", "is", "was", "lost", "found", "for", "to", "from", "some", "item"]);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

function sideText(s: Pick<MatchSide, "title" | "description" | "attributes">) {
  const a = s.attributes ?? {};
  return [s.title, s.description, a.color, a.brand, a.material, ...(a.marks ?? [])].filter(Boolean).join(" ");
}

export function keywordOverlap(a: Pick<MatchSide, "title" | "description" | "attributes">, b: Pick<MatchSide, "title" | "description" | "attributes">): number {
  const ta = tokens(sideText(a));
  const tb = tokens(sideText(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

function colorsMatch(a?: string, b?: string) {
  const ca = tokens(norm(a));
  const cb = tokens(norm(b));
  if (ca.size === 0 || cb.size === 0) return false;
  for (const c of ca) if (cb.has(c)) return true;
  return false;
}

function brandsMatch(a?: string, b?: string) {
  const x = norm(a);
  const y = norm(b);
  return x.length > 1 && y.length > 1 && (x === y || x.includes(y) || y.includes(x));
}

/** Map raw cosine similarity of gemini-embedding-2 vectors onto 0..1 (calibrated: unrelated ~0.67, same item ~0.84). */
export function semanticScore(similarity: number): number {
  return Math.min(1, Math.max(0, (similarity - 0.66) / (0.86 - 0.66)));
}

export interface ScoredMatch {
  score: number;
  distanceM: number;
  /** ms between the start of the loss window and when the item was found (negative = found earlier). */
  gapMs: number;
  brand: string | null;
  color: string | null;
  semantic: number;
  excluded: boolean;
}

export function scoreMatch(lost: MatchSide, found: MatchSide, similarity: number | null): ScoredMatch {
  const distanceM = Math.round(distanceMeters(lost.lat, lost.lng, found.lat, found.lng));
  const lostFrom = new Date(lost.occurredFrom).getTime();
  const lostTo = new Date(lost.occurredTo).getTime();
  const foundFrom = new Date(found.occurredFrom).getTime();
  const foundTo = new Date(found.occurredTo).getTime();
  const gapMs = foundFrom - lostFrom;

  const sameCategory = lost.category === found.category || lost.category === "other" || found.category === "other";
  const foundBeforeLost = foundTo < lostFrom - EARLY_TOLERANCE_MS;
  const excluded = !sameCategory || foundBeforeLost || distanceM > MAX_MATCH_RADIUS_M;

  const semantic =
    similarity != null
      ? Math.max(semanticScore(similarity), keywordOverlap(lost, found) * 0.8)
      : keywordOverlap(lost, found);

  const distanceFactor = Math.exp(-distanceM / 3000);
  const waitMs = Math.max(0, foundFrom - lostTo);
  const timeFactor = Math.exp(-waitMs / (7 * 24 * 3600 * 1000));
  const brandHit = brandsMatch(lost.attributes?.brand, found.attributes?.brand);
  const colorHit = colorsMatch(lost.attributes?.color, found.attributes?.color);

  let score = 0.5 * semantic + 0.2 * distanceFactor + 0.15 * timeFactor + (brandHit ? 0.1 : 0) + (colorHit ? 0.05 : 0);
  if (lost.category !== found.category) score *= 0.85;
  score = excluded ? 0 : Math.min(1, Math.round(score * 1000) / 1000);

  return {
    score,
    distanceM,
    gapMs,
    brand: brandHit ? found.attributes?.brand?.trim() || lost.attributes?.brand?.trim() || null : null,
    color: colorHit ? norm(found.attributes?.color) : null,
    semantic,
    excluded,
  };
}

export type Perspective = "owner" | "finder" | "neutral";

/** Readable reasons, e.g. ["Same brand: Apple", "400 m away", "Found 2 h after you lost it"]. */
export function explainMatch(m: Pick<ScoredMatch, "distanceM" | "gapMs" | "brand" | "color" | "semantic">, perspective: Perspective): string[] {
  const reasons: string[] = [];
  if (m.brand) reasons.push(`Same brand: ${m.brand}`);
  if (m.color) reasons.push(`Same color: ${m.color}`);
  if (m.semantic >= 0.75) reasons.push("Very similar description");
  else if (m.semantic >= 0.45) reasons.push("Similar description");
  reasons.push(m.distanceM < 50 ? "Same spot" : perspective === "neutral" ? formatDistance(m.distanceM).replace("away", "apart") : formatDistance(m.distanceM));
  const gap = humanDuration(m.gapMs);
  if (Math.abs(m.gapMs) < 30 * 60 * 1000) reasons.push("Found around the time it went missing");
  else if (m.gapMs > 0)
    reasons.push(
      perspective === "owner"
        ? `Found ${gap} after you lost it`
        : perspective === "finder"
          ? `Lost ${gap} before you found it`
          : `Found ${gap} after it was lost`,
    );
  else reasons.push(perspective === "owner" ? `Reported ${gap} before your loss time` : `Reported ${gap} before the loss time`);
  return reasons;
}

/** Text used for the item embedding. Hidden verification answers are never included. */
export function embeddingText(i: Pick<MatchSide, "category" | "title" | "description" | "attributes"> & { kind: string }) {
  const a = i.attributes ?? {};
  return [
    `${i.kind} ${i.category}: ${i.title}.`,
    i.description,
    a.color ? `Color: ${a.color}.` : "",
    a.brand ? `Brand: ${a.brand}.` : "",
    a.material ? `Material: ${a.material}.` : "",
    a.marks?.length ? `Marks: ${a.marks.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
