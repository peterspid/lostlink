import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { badRequest, handle, parseJson, requireUser } from "@/lib/api";
import { createDesk, myDesks } from "@/lib/desks";
import { rateLimit } from "@/lib/ratelimit";
import { deskCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  const me = await requireUser();
  const rows = await myDesks(me.id);
  return NextResponse.json({ desks: rows.map((r) => ({ id: r.desk.id, slug: r.desk.slug, name: r.desk.name, kind: r.desk.kind, role: r.role })) });
});

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  await rateLimit(`desk:${me.id}`, 5, 3600, "You've created several desks this hour. Try again later.");
  const input = await parseJson(req, deskCreateSchema);
  const [{ n }] = await db().select({ n: count() }).from(schema.desks).where(eq(schema.desks.ownerId, me.id));
  if (n >= 10) throw badRequest("You can own up to 10 desks.");
  const desk = await createDesk(me, input);
  return NextResponse.json({ id: desk.id, slug: desk.slug }, { status: 201 });
});
