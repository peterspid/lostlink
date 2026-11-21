import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { badRequest, handle, notFound, parseJson, requireUser } from "@/lib/api";
import { addToBlocklist, removeFromBlocklist } from "@/lib/nexconn/server";
import { blockSchema } from "@/lib/validation";

async function target(userId: string) {
  const [u] = await db().select({ id: schema.users.id, nexconnId: schema.users.nexconnId }).from(schema.users).where(eq(schema.users.id, userId));
  if (!u) throw notFound("That person doesn't exist.");
  return u;
}

/** Block a person: stored in our DB (claims, items) and in the Nexconn blocklist (direct messages). */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const { userId } = await parseJson(req, blockSchema);
  if (userId === me.id) throw badRequest("You can't block yourself.");
  const other = await target(userId);
  // Postgres is the source of truth (claims, composer); the Nexconn blocklist also stops direct
  // messages at the chat layer and is re-synced whenever the user is registered again.
  await db().insert(schema.blocks).values({ blockerId: me.id, blockedId: other.id }).onConflictDoNothing();
  await addToBlocklist(me.nexconnId, [other.nexconnId]).catch((err) => console.error("[blocks] nexconn add failed", err));
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireUser();
  const { userId } = await parseJson(req, blockSchema);
  const other = await target(userId);
  await db().delete(schema.blocks).where(and(eq(schema.blocks.blockerId, me.id), eq(schema.blocks.blockedId, other.id)));
  await removeFromBlocklist(me.nexconnId, [other.nexconnId]).catch((err) => console.error("[blocks] nexconn remove failed", err));
  return NextResponse.json({ ok: true });
});
