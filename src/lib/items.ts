import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Item, ItemAttributes } from "@/lib/db/schema";
import { fuzzLocation } from "@/lib/geo";
import { newId, newItemCode } from "@/lib/ids";
import { embeddingText } from "@/lib/match-score";
import { tryEmbed } from "@/lib/gemini";
import type { ItemCreateInput } from "@/lib/validation";
import { DAY_MS } from "@/lib/time";

export const ITEM_TTL_DAYS = 60;

export async function createItem(ownerId: string, input: ItemCreateInput): Promise<Item> {
  const id = newId();
  const attributes: ItemAttributes = {
    color: input.color || undefined,
    brand: input.brand || undefined,
    material: input.material || undefined,
    marks: input.marks.filter(Boolean),
  };
  const fuzz = fuzzLocation(input.lat, input.lng, id);
  const embedding = await tryEmbed(embeddingText({ ...input, attributes }));

  let code = newItemCode();
  for (let i = 0; i < 3; i++) {
    const [{ n }] = await db().select({ n: count() }).from(schema.items).where(eq(schema.items.code, code));
    if (n === 0) break;
    code = newItemCode();
  }

  const [item] = await db()
    .insert(schema.items)
    .values({
      id,
      code,
      ownerId,
      deskId: input.deskId ?? null,
      kind: input.kind,
      category: input.category,
      title: input.title,
      description: input.description,
      attributes,
      photos: input.photos,
      lat: input.lat,
      lng: input.lng,
      publicLat: fuzz.lat,
      publicLng: fuzz.lng,
      placeLabel: input.placeLabel,
      occurredFrom: input.occurredFrom,
      occurredTo: input.occurredTo,
      expiresAt: new Date(Date.now() + ITEM_TTL_DAYS * DAY_MS),
      embedding,
      aiFilled: input.aiFilled,
    })
    .returning();

  if (input.kind === "found" && input.questions.length) {
    await db()
      .insert(schema.verificationQuestions)
      .values(input.questions.map((q, i) => ({ id: newId(), itemId: id, question: q.question, answer: q.answer, position: i })));
  }
  return item;
}

export async function getItem(id: string): Promise<Item | null> {
  const [item] = await db().select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
  return item ?? null;
}

export async function isDeskStaff(deskId: string | null, userId: string): Promise<boolean> {
  if (!deskId) return false;
  const [m] = await db()
    .select({ role: schema.deskMembers.role })
    .from(schema.deskMembers)
    .where(and(eq(schema.deskMembers.deskId, deskId), eq(schema.deskMembers.userId, userId)))
    .limit(1);
  return !!m;
}

/** Can this user manage the item (owner, or staff of the desk that logged it)? */
export async function canManageItem(item: Item, userId: string): Promise<boolean> {
  return item.ownerId === userId || (await isDeskStaff(item.deskId, userId));
}

export interface PublicItem {
  id: string;
  code: string;
  kind: "lost" | "found";
  status: Item["status"];
  category: string;
  title: string;
  description: string;
  attributes: ItemAttributes;
  photos: string[];
  lat: number;
  lng: number;
  exactLocation: boolean;
  placeLabel: string;
  occurredFrom: string;
  occurredTo: string;
  expiresAt: string;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  deskId: string | null;
  deskName: string | null;
  deskSlug: string | null;
  questionCount: number;
}

/**
 * Shape an item for a viewer. Found items hide identifying attributes (brand, material,
 * marks) from everyone except people who manage it; locations are fuzzed for non-managers.
 */
export function toPublicItem(
  item: Item,
  extra: { ownerName: string; deskName?: string | null; deskSlug?: string | null; questionCount?: number },
  canSeePrivate: boolean,
): PublicItem {
  const attrs = item.attributes ?? {};
  const attributes: ItemAttributes =
    item.kind === "found" && !canSeePrivate ? { color: attrs.color } : attrs;
  return {
    id: item.id,
    code: item.code,
    kind: item.kind,
    status: item.status,
    category: item.category,
    title: item.title,
    description: item.description,
    attributes,
    photos: item.photos,
    lat: canSeePrivate ? item.lat : item.publicLat,
    lng: canSeePrivate ? item.lng : item.publicLng,
    exactLocation: canSeePrivate,
    placeLabel: item.placeLabel,
    occurredFrom: item.occurredFrom.toISOString(),
    occurredTo: item.occurredTo.toISOString(),
    expiresAt: item.expiresAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    ownerId: item.ownerId,
    ownerName: firstName(extra.ownerName),
    deskId: item.deskId,
    deskName: extra.deskName ?? null,
    deskSlug: extra.deskSlug ?? null,
    questionCount: extra.questionCount ?? 0,
  };
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export async function ownerNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db()
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function blockedBetween(a: string, b: string): Promise<{ aBlockedB: boolean; bBlockedA: boolean }> {
  const rows = await db()
    .select()
    .from(schema.blocks)
    .where(inArray(schema.blocks.blockerId, [a, b]));
  return {
    aBlockedB: rows.some((r) => r.blockerId === a && r.blockedId === b),
    bBlockedA: rows.some((r) => r.blockerId === b && r.blockedId === a),
  };
}

export function isExpiringSoon(item: Pick<Item, "status" | "expiresAt">, now = Date.now()): boolean {
  return item.status === "open" && item.expiresAt.getTime() - now < 5 * DAY_MS;
}
