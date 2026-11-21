import { NextResponse } from "next/server";
import { handle, parseJson, requireUser } from "@/lib/api";
import { leaveThanks } from "@/lib/claims";
import { thanksSchema } from "@/lib/validation";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/claims/[id]/thanks">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const { text } = await parseJson(req, thanksSchema);
  await leaveThanks(me.id, id, text);
  return NextResponse.json({ ok: true });
});
