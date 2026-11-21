import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { cancelClaim, claimForParticipant } from "@/lib/claims";
import { buildClaimView } from "@/lib/claim-view";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/claims/[id]">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const { claim, item } = await claimForParticipant(id, me.id);
  return NextResponse.json({ claim: await buildClaimView(claim, item, me.id) });
});

/** Withdraw a claim (claimant only). */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/claims/[id]">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  await cancelClaim(me.id, id);
  return NextResponse.json({ ok: true });
});
