import { NextResponse } from "next/server";
import { handle, parseJson, requireUser } from "@/lib/api";
import { joinDeskByToken } from "@/lib/desks";
import { rateLimit } from "@/lib/ratelimit";
import { joinDeskSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  await rateLimit(`desk-join:${me.id}`, 20, 3600);
  const { token } = await parseJson(req, joinDeskSchema);
  const desk = await joinDeskByToken(me, token);
  return NextResponse.json({ slug: desk.slug });
});
