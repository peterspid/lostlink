import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, requireUser } from "@/lib/api";
import { issueAccessToken } from "@/lib/nexconn/server";
import { rateLimit } from "@/lib/ratelimit";

/** Chat credentials for the signed-in user. Only the App Key (public) and the user's own token are returned. */
export const GET = handle(async () => {
  const me = await requireUser();
  const [row] = await db()
    .select({ token: schema.users.nexconnToken })
    .from(schema.users)
    .where(eq(schema.users.id, me.id))
    .limit(1);
  let token = row?.token ?? null;
  if (!token) token = await reissue(me.id, me.nexconnId, me.name);
  return NextResponse.json(
    { appKey: env().NEXCONN_APP_KEY, userId: me.nexconnId, token, name: me.name },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/** Called by the client after a connect failure with an invalid/expired token (31004). */
export const POST = handle(async () => {
  const me = await requireUser();
  await rateLimit(`token-refresh:${me.id}`, 5, 600);
  const token = await reissue(me.id, me.nexconnId, me.name);
  return NextResponse.json({ appKey: env().NEXCONN_APP_KEY, userId: me.nexconnId, token, name: me.name });
});

async function reissue(id: string, nexconnId: string, name: string) {
  const token = await issueAccessToken(nexconnId, name);
  await db().update(schema.users).set({ nexconnToken: token }).where(eq(schema.users.id, id));
  return token;
}
