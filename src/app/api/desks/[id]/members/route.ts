import { NextResponse } from "next/server";
import { z } from "zod";
import { forbidden, handle, notFound, parseJson, requireUser } from "@/lib/api";
import { deskMembers, deskRole, getDesk, removeStaff, rotateInvite } from "@/lib/desks";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/desks/[id]/members">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const desk = await getDesk(id);
  if (!desk) throw notFound();
  if (!(await deskRole(id, me.id))) throw forbidden();
  return NextResponse.json({ members: await deskMembers(id) });
});

/** Owner: remove a staff member (also removed from the Nexconn staff group). */
export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/desks/[id]/members">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const { userId } = await parseJson(req, z.object({ userId: z.string().min(1).max(40) }));
  await removeStaff(me.id, id, userId);
  return NextResponse.json({ ok: true });
});

/** Owner: reset the invite link. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/desks/[id]/members">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const token = await rotateInvite(me.id, id);
  return NextResponse.json({ token });
});
