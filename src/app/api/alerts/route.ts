import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { badRequest, handle, parseJson, requireUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { tryEmbed } from "@/lib/gemini";
import { alertCreateSchema } from "@/lib/validation";

const MAX_ALERTS = 10;

export const GET = handle(async () => {
  const me = await requireUser();
  const rows = await db()
    .select({
      id: schema.alerts.id,
      query: schema.alerts.query,
      category: schema.alerts.category,
      lat: schema.alerts.lat,
      lng: schema.alerts.lng,
      placeLabel: schema.alerts.placeLabel,
      radiusM: schema.alerts.radiusM,
      active: schema.alerts.active,
      lastNotifiedAt: schema.alerts.lastNotifiedAt,
      createdAt: schema.alerts.createdAt,
    })
    .from(schema.alerts)
    .where(eq(schema.alerts.userId, me.id))
    .orderBy(desc(schema.alerts.createdAt));
  return NextResponse.json({ alerts: rows });
});

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const input = await parseJson(req, alertCreateSchema);
  const [{ n }] = await db().select({ n: count() }).from(schema.alerts).where(eq(schema.alerts.userId, me.id));
  if (n >= MAX_ALERTS) throw badRequest(`You can keep up to ${MAX_ALERTS} alerts. Delete one first.`);
  const embedding = await tryEmbed(`found ${input.category ?? ""} ${input.query}`);
  const id = newId();
  await db().insert(schema.alerts).values({
    id,
    userId: me.id,
    query: input.query,
    category: input.category ?? null,
    lat: input.lat,
    lng: input.lng,
    placeLabel: input.placeLabel,
    radiusM: input.radiusM,
    embedding,
  });
  return NextResponse.json({ id }, { status: 201 });
});
