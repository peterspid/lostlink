import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { confirmReturned } from "@/lib/claims";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/claims/[id]/returned">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json(await confirmReturned(me.id, id));
});
