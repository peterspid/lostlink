import "server-only";
import { and, desc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { CATEGORY_IDS } from "@/lib/categories";
import { boundingBox, distanceMeters } from "@/lib/geo";
import { toPublicItem, type PublicItem } from "@/lib/items";
import { tryEmbed } from "@/lib/gemini";
import { DAY_MS } from "@/lib/time";

export const searchParamsSchema = z.object({
  kind: z.enum(["lost", "found"]).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  q: z.string().trim().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.2).max(50).optional(),
  days: z.coerce.number().int().min(1).max(60).optional(),
  deskId: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export interface SearchResult extends PublicItem {
  distanceM: number | null;
}

/** Public browse/search over open, unexpired items. Locations are always the fuzzed public ones. */
export async function searchItems(p: SearchParams): Promise<SearchResult[]> {
  const t = schema.items;
  const where: SQL[] = [eq(t.status, "open"), gt(t.expiresAt, new Date())];
  if (p.kind) where.push(eq(t.kind, p.kind));
  if (p.category) where.push(eq(t.category, p.category));
  if (p.deskId) where.push(eq(t.deskId, p.deskId));
  if (p.days) where.push(gt(t.occurredTo, new Date(Date.now() - p.days * DAY_MS)));
  const hasPoint = p.lat != null && p.lng != null;
  if (hasPoint && p.radiusKm) {
    const box = boundingBox(p.lat!, p.lng!, p.radiusKm * 1000);
    where.push(sql`${t.publicLat} BETWEEN ${box.minLat} AND ${box.maxLat}`);
    where.push(sql`${t.publicLng} BETWEEN ${box.minLng} AND ${box.maxLng}`);
  }

  let order: SQL = desc(t.createdAt);
  if (p.q) {
    const like = `%${p.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const textMatch = or(ilike(t.title, like), ilike(t.description, like), sql`${t.attributes}->>'color' ILIKE ${like}`, sql`${t.attributes}->>'brand' ILIKE ${like}`)!;
    const qv = await tryEmbed(`${p.kind ?? ""} ${p.q}`);
    if (qv) {
      const v = `[${qv.join(",")}]`;
      where.push(or(textMatch, sql`(${t.embedding} IS NOT NULL AND 1 - (${t.embedding} <=> ${v}::vector) > 0.70)`)!);
      order = sql`${t.embedding} <=> ${v}::vector NULLS LAST`;
    } else {
      where.push(textMatch);
    }
  }

  const rows = await db()
    .select({
      item: t,
      ownerName: schema.users.name,
      deskName: schema.desks.name,
      deskSlug: schema.desks.slug,
      questionCount: sql<number>`(SELECT count(*)::int FROM ${schema.verificationQuestions} vq WHERE vq.item_id = ${t.id})`,
    })
    .from(t)
    .innerJoin(schema.users, eq(schema.users.id, t.ownerId))
    .leftJoin(schema.desks, eq(schema.desks.id, t.deskId))
    .where(and(...where))
    .orderBy(order)
    .limit(p.limit);

  const results = rows.map((r) => {
    const pub = toPublicItem(r.item, { ownerName: r.ownerName, deskName: r.deskName, deskSlug: r.deskSlug, questionCount: Number(r.questionCount) }, false);
    const distanceM = hasPoint ? Math.round(distanceMeters(p.lat!, p.lng!, pub.lat, pub.lng)) : null;
    return { ...pub, distanceM };
  });
  const filtered = hasPoint && p.radiusKm ? results.filter((r) => (r.distanceM ?? 0) <= p.radiusKm! * 1000) : results;
  if (hasPoint && !p.q) filtered.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  return filtered;
}
