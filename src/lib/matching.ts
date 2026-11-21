import "server-only";
import { and, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Item } from "@/lib/db/schema";
import { boundingBox, distanceMeters, formatDistance } from "@/lib/geo";
import { newId } from "@/lib/ids";
import {
  EARLY_TOLERANCE_MS,
  MATCH_KEEP_THRESHOLD,
  MATCH_NOTIFY_THRESHOLD,
  MAX_MATCH_RADIUS_M,
  embeddingText,
  explainMatch,
  scoreMatch,
} from "@/lib/match-score";
import { notify } from "@/lib/notify";
import { tryEmbed } from "@/lib/gemini";
import { alertMatchesText } from "@/lib/text-match";
import { toPublicItem, type PublicItem } from "@/lib/items";

const vec = (v: number[]) => `[${v.join(",")}]`;

/** Make sure an item has an embedding (AI may have been busy at post time). */
export async function ensureEmbedding(item: Item): Promise<number[] | null> {
  if (item.embedding) return item.embedding;
  const e = await tryEmbed(embeddingText(item));
  if (e) {
    await db().update(schema.items).set({ embedding: e }).where(eq(schema.items.id, item.id));
  }
  return e;
}

export interface MatchRunResult {
  kept: number;
  notified: number;
}

/**
 * Find candidates of the opposite kind for `item`, score them, upsert matches and notify
 * both sides about new strong matches. Safe to re-run (recompute on demand).
 */
export async function runMatching(
  item: Item,
  opts: { notify?: boolean; /** Collect notifications to send after the response instead of awaiting them. */ defer?: (job: () => Promise<void>) => void } = {},
): Promise<MatchRunResult> {
  if (item.status !== "open") return { kept: 0, notified: 0 };
  const embedding = await ensureEmbedding(item);
  const other = item.kind === "lost" ? "found" : "lost";
  const box = boundingBox(item.lat, item.lng, MAX_MATCH_RADIUS_M);
  const t = schema.items;

  const timeFilter =
    item.kind === "lost"
      ? gt(t.occurredTo, new Date(new Date(item.occurredFrom).getTime() - EARLY_TOLERANCE_MS))
      : sql`${t.occurredFrom} < ${new Date(new Date(item.occurredTo).getTime() + EARLY_TOLERANCE_MS)}`;

  const categoryFilter =
    item.category === "other" ? sql`true` : sql`(${t.category} = ${item.category} OR ${t.category} = 'other')`;

  const similarity = embedding
    ? sql<number | null>`CASE WHEN ${t.embedding} IS NULL THEN NULL ELSE 1 - (${t.embedding} <=> ${vec(embedding)}::vector) END`
    : sql<number | null>`NULL`;

  const candidates = await db()
    .select({ item: t, similarity })
    .from(t)
    .where(
      and(
        eq(t.kind, other),
        eq(t.status, "open"),
        gt(t.expiresAt, new Date()),
        ne(t.ownerId, item.ownerId),
        sql`${t.lat} BETWEEN ${box.minLat} AND ${box.maxLat}`,
        sql`${t.lng} BETWEEN ${box.minLng} AND ${box.maxLng}`,
        timeFilter,
        categoryFilter,
      ),
    )
    .orderBy(embedding ? sql`${t.embedding} <=> ${vec(embedding)}::vector NULLS LAST` : sql`${t.createdAt} DESC`)
    .limit(40);

  const existing = await db()
    .select({ lost: schema.matches.lostItemId, found: schema.matches.foundItemId })
    .from(schema.matches)
    .where(item.kind === "lost" ? eq(schema.matches.lostItemId, item.id) : eq(schema.matches.foundItemId, item.id));
  const known = new Set(existing.map((e) => `${e.lost}:${e.found}`));

  let kept = 0;
  let notified = 0;
  for (const c of candidates) {
    const lost = item.kind === "lost" ? item : c.item;
    const found = item.kind === "lost" ? c.item : item;
    const sim = c.similarity == null ? null : Number(c.similarity);
    const s = scoreMatch(lost, found, sim);
    if (s.excluded || s.score < MATCH_KEEP_THRESHOLD) continue;
    kept++;
    const reasons = explainMatch(s, "neutral");
    await db()
      .insert(schema.matches)
      .values({ id: newId(), lostItemId: lost.id, foundItemId: found.id, score: s.score, similarity: sim, reasons, distanceM: s.distanceM })
      .onConflictDoUpdate({
        target: [schema.matches.lostItemId, schema.matches.foundItemId],
        set: { score: s.score, similarity: sim, reasons, distanceM: s.distanceM },
      });

    const isNew = !known.has(`${lost.id}:${found.id}`);
    if (isNew && opts.notify !== false && s.score >= MATCH_NOTIFY_THRESHOLD) {
      notified++;
      const ownerReasons = explainMatch(s, "owner").slice(0, 3).join(", ");
      const finderReasons = explainMatch(s, "finder").slice(0, 3).join(", ");
      const job = async () => {
        await Promise.all([
          notify([lost.ownerId], {
        kind: "match",
        title: `Possible match for your ${lost.title.toLowerCase()}`,
        body: `Someone found "${found.title}". ${ownerReasons}.`,
        href: `/items/${found.id}?from=${lost.id}`,
      }),
          notify([found.ownerId], {
        kind: "match",
        title: `"${found.title}" may belong to someone`,
        body: `A person reported losing "${lost.title}". ${finderReasons}.`,
        href: `/items/${found.id}`,
      }),
        ]);
      };
      if (opts.defer) opts.defer(job);
      else await job();
    }
  }
  return { kept, notified };
}

/** Check saved searches ("tell me if a black wallet is found within 3 km") against a new found item. */
export async function checkAlerts(item: Item): Promise<number> {
  if (item.kind !== "found" || item.status !== "open") return 0;
  const a = schema.alerts;
  // Alerts can have a radius up to 25 km; prefilter by the largest box.
  const box = boundingBox(item.lat, item.lng, 25_000);
  const similarity = item.embedding
    ? sql<number | null>`CASE WHEN ${a.embedding} IS NULL THEN NULL ELSE 1 - (${a.embedding} <=> ${vec(item.embedding)}::vector) END`
    : sql<number | null>`NULL`;
  const rows = await db()
    .select({ alert: a, similarity })
    .from(a)
    .where(
      and(
        eq(a.active, true),
        ne(a.userId, item.ownerId),
        sql`${a.lat} BETWEEN ${box.minLat} AND ${box.maxLat}`,
        sql`${a.lng} BETWEEN ${box.minLng} AND ${box.maxLng}`,
      ),
    )
    .limit(500);

  const hits: { alertId: string; userId: string; query: string; distance: number }[] = [];
  for (const r of rows) {
    const d = distanceMeters(r.alert.lat, r.alert.lng, item.lat, item.lng);
    if (d > r.alert.radiusM) continue;
    if (r.alert.category && r.alert.category !== item.category && item.category !== "other") continue;
    if (!alertMatchesText(r.alert.query, item, r.similarity == null ? null : Number(r.similarity))) continue;
    hits.push({ alertId: r.alert.id, userId: r.alert.userId, query: r.alert.query, distance: d });
  }
  if (hits.length === 0) return 0;

  const already = await db()
    .select({ alertId: schema.alertHits.alertId })
    .from(schema.alertHits)
    .where(and(eq(schema.alertHits.itemId, item.id), inArray(schema.alertHits.alertId, hits.map((h) => h.alertId))));
  const done = new Set(already.map((x) => x.alertId));
  let sent = 0;
  for (const h of hits) {
    if (done.has(h.alertId)) continue;
    await db().insert(schema.alertHits).values({ alertId: h.alertId, itemId: item.id }).onConflictDoNothing();
    await db().update(schema.alerts).set({ lastNotifiedAt: new Date() }).where(eq(schema.alerts.id, h.alertId));
    await notify([h.userId], {
      kind: "alert",
      title: `Alert: "${h.query}"`,
      body: `"${item.title}" was just found, ${formatDistance(h.distance)}.`,
      href: `/items/${item.id}`,
    });
    sent++;
  }
  return sent;
}

export interface MatchView {
  matchId: string;
  score: number;
  reasons: string[];
  distanceM: number;
  other: PublicItem;
}

/** Ranked matches for an item, explained from the viewer's side (owner of a lost item, or finder). */
export async function listMatches(item: Item): Promise<MatchView[]> {
  const isLost = item.kind === "lost";
  const m = schema.matches;
  const t = schema.items;
  const rows = await db()
    .select({ match: m, other: t, ownerName: schema.users.name, deskName: schema.desks.name, deskSlug: schema.desks.slug })
    .from(m)
    .innerJoin(t, eq(t.id, isLost ? m.foundItemId : m.lostItemId))
    .innerJoin(schema.users, eq(schema.users.id, t.ownerId))
    .leftJoin(schema.desks, eq(schema.desks.id, t.deskId))
    .where(and(isLost ? eq(m.lostItemId, item.id) : eq(m.foundItemId, item.id), inArray(t.status, ["open", "claimed"]), gt(t.expiresAt, new Date())))
    .orderBy(sql`${m.score} DESC`)
    .limit(20);
  return rows.map((r) => {
    const lost = isLost ? item : r.other;
    const found = isLost ? r.other : item;
    const s = scoreMatch(lost, found, r.match.similarity);
    return {
      matchId: r.match.id,
      score: r.match.score,
      reasons: explainMatch(s, isLost ? "owner" : "finder"),
      distanceM: r.match.distanceM,
      other: toPublicItem(r.other, { ownerName: r.ownerName, deskName: r.deskName, deskSlug: r.deskSlug }, false),
    };
  });
}
