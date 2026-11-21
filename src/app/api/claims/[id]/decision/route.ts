import { NextResponse } from "next/server";
import { handle, parseJson, requireUser } from "@/lib/api";
import { decideClaim } from "@/lib/claims";
import { decisionSchema } from "@/lib/validation";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/claims/[id]/decision">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const { approve, note } = await parseJson(req, decisionSchema);
  return NextResponse.json(await decideClaim(me.id, id, approve, note));
});
