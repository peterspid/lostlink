import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { handle, parseJson, requireUser } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";
import { dismissGroup } from "@/lib/nexconn/server";

/** Delete my account and everything I own (posts, claims, alerts, desks). Irreversible. */
export const DELETE = handle(async (req: Request) => {
  const me = await requireUser();
  await parseJson(req, z.object({ confirm: z.literal("DELETE") }));
  const owned = await db().select({ group: schema.desks.nexconnGroupId }).from(schema.desks).where(eq(schema.desks.ownerId, me.id));
  for (const d of owned) await dismissGroup(d.group).catch(() => undefined);
  await db().delete(schema.users).where(eq(schema.users.id, me.id));
  await destroySession();
  return NextResponse.json({ ok: true });
});
