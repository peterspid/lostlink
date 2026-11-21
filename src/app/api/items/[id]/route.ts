import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { conflict, forbidden, handle, notFound, parseJson, requireUser } from "@/lib/api";
import { currentUser } from "@/lib/auth/session";
import { canManageItem, getItem, ITEM_TTL_DAYS, ownerNames, toPublicItem } from "@/lib/items";
import { runMatching } from "@/lib/matching";
import { itemPatchSchema } from "@/lib/validation";
import { DAY_MS } from "@/lib/time";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/items/[id]">) => {
  const { id } = await ctx.params;
  const item = await getItem(id);
  if (!item || item.status === "hidden") throw notFound("This post doesn't exist or was removed.");
  const me = await currentUser();
  const manage = me ? await canManageItem(item, me.id) : false;
  const names = await ownerNames([item.ownerId]);
  const [{ n }] = await db().select({ n: count() }).from(schema.verificationQuestions).where(eq(schema.verificationQuestions.itemId, id));
  return NextResponse.json({ item: toPublicItem(item, { ownerName: names.get(item.ownerId) ?? "Someone", questionCount: n }, manage), canManage: manage });
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/items/[id]">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const item = await getItem(id);
  if (!item) throw notFound();
  if (!(await canManageItem(item, me.id))) throw forbidden();
  const { action } = await parseJson(req, itemPatchSchema);
  if (action === "renew") {
    if (!["open", "expired"].includes(item.status)) throw conflict("Only open or expired posts can be renewed.");
    const [updated] = await db()
      .update(schema.items)
      .set({ status: "open", expiresAt: new Date(Date.now() + ITEM_TTL_DAYS * DAY_MS), renewPromptedAt: null, updatedAt: new Date() })
      .where(eq(schema.items.id, id))
      .returning();
    await runMatching(updated).catch(() => undefined);
  } else if (action === "close") {
    await db().update(schema.items).set({ status: "closed", updatedAt: new Date() }).where(and(eq(schema.items.id, id)));
  } else if (action === "reopen") {
    if (item.status !== "closed") throw conflict("Only closed posts can be reopened.");
    await db().update(schema.items).set({ status: "open", updatedAt: new Date() }).where(eq(schema.items.id, id));
  }
  return NextResponse.json({ ok: true });
});
