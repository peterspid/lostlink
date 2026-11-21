import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { badRequest, handle, parseJson, requireUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { rateLimit } from "@/lib/ratelimit";
import { reportSchema } from "@/lib/validation";

/** Items reported by this many different people are hidden until reviewed. */
const HIDE_AFTER_REPORTS = 3;

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  await rateLimit(`report:${me.id}`, 20, 3600);
  const input = await parseJson(req, reportSchema);
  if (input.userId === me.id) throw badRequest("You can't report yourself.");
  const [dup] = await db()
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.reporterId, me.id),
        input.itemId ? eq(schema.reports.itemId, input.itemId) : isNull(schema.reports.itemId),
        input.userId ? eq(schema.reports.reportedUserId, input.userId) : isNull(schema.reports.reportedUserId),
      ),
    )
    .limit(1);
  if (dup) return NextResponse.json({ ok: true, alreadyReported: true });
  const inserted = await db()
    .insert(schema.reports)
    .values({
      id: newId(),
      reporterId: me.id,
      itemId: input.itemId ?? null,
      reportedUserId: input.userId ?? null,
      reason: input.reason,
      details: input.details,
    })
    .onConflictDoNothing()
    .returning({ id: schema.reports.id });

  if (inserted.length && input.itemId) {
    const [item] = await db()
      .update(schema.items)
      .set({ reportCount: sql`${schema.items.reportCount} + 1` })
      .where(eq(schema.items.id, input.itemId))
      .returning({ reportCount: schema.items.reportCount, ownerId: schema.items.ownerId });
    if (item && item.ownerId !== me.id && item.reportCount >= HIDE_AFTER_REPORTS) {
      await db().update(schema.items).set({ status: "hidden" }).where(eq(schema.items.id, input.itemId));
    }
  }
  return NextResponse.json({ ok: true }, { status: 201 });
});
