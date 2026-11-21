import { NextResponse } from "next/server";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { handle, parseJson, requireUser } from "@/lib/api";

export const GET = handle(async () => {
  const me = await requireUser();
  const n = schema.notifications;
  const items = await db()
    .select({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })
    .from(n)
    .where(eq(n.userId, me.id))
    .orderBy(desc(n.createdAt))
    .limit(50);
  const [{ unread }] = await db().select({ unread: count() }).from(n).where(and(eq(n.userId, me.id), isNull(n.readAt)));
  return NextResponse.json({ notifications: items, unread }, { headers: { "Cache-Control": "no-store" } });
});

const markSchema = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().max(40)).min(1).max(100) })]);

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const body = await parseJson(req, markSchema);
  const n = schema.notifications;
  const where =
    "all" in body
      ? and(eq(n.userId, me.id), isNull(n.readAt))
      : and(eq(n.userId, me.id), inArray(n.id, body.ids), isNull(n.readAt));
  await db().update(n).set({ readAt: new Date() }).where(where);
  return NextResponse.json({ ok: true });
});
