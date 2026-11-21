import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { handle, notFound, parseJson, requireUser } from "@/lib/api";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/alerts/[id]">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const { active } = await parseJson(req, z.object({ active: z.boolean() }));
  const rows = await db()
    .update(schema.alerts)
    .set({ active })
    .where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, me.id)))
    .returning({ id: schema.alerts.id });
  if (rows.length === 0) throw notFound();
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/alerts/[id]">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const rows = await db()
    .delete(schema.alerts)
    .where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, me.id)))
    .returning({ id: schema.alerts.id });
  if (rows.length === 0) throw notFound();
  return NextResponse.json({ ok: true });
});
