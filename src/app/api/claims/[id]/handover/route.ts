import { NextResponse } from "next/server";
import { handle, parseJson, requireUser } from "@/lib/api";
import { proposeHandover, respondHandover } from "@/lib/claims";
import { handoverActionSchema, handoverSchema } from "@/lib/validation";

/** Propose a meeting point and time; sends a handover card into the direct channel. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/claims/[id]/handover">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const plan = await parseJson(req, handoverSchema);
  return NextResponse.json({ handover: await proposeHandover(me.id, id, plan) }, { status: 201 });
});

/** Accept or decline the other person's proposal; updates the card's metadata. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/claims/[id]/handover">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const { action } = await parseJson(req, handoverActionSchema);
  return NextResponse.json({ handover: await respondHandover(me.id, id, action) });
});
