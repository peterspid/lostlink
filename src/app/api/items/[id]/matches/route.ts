import { NextResponse } from "next/server";
import { forbidden, handle, notFound, requireUser } from "@/lib/api";
import { canManageItem, getItem } from "@/lib/items";
import { listMatches, runMatching } from "@/lib/matching";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/items/[id]/matches">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const item = await getItem(id);
  if (!item) throw notFound();
  if (!(await canManageItem(item, me.id))) throw forbidden("Only the person who posted this can see its matches.");
  return NextResponse.json({ matches: await listMatches(item) });
});

/** Recompute matches on demand (e.g. AI was busy when the item was posted). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/items/[id]/matches">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const item = await getItem(id);
  if (!item) throw notFound();
  if (!(await canManageItem(item, me.id))) throw forbidden();
  await rateLimit(`rematch:${me.id}`, 20, 3600);
  const result = await runMatching(item);
  return NextResponse.json({ ...result, matches: await listMatches(item) });
});
