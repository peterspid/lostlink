import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, notFound, requireUser } from "@/lib/api";
import { chatToken, nexconnUserColumns, reissueToken } from "@/lib/nexconn/users";
import { rateLimit } from "@/lib/ratelimit";

async function me() {
  const user = await requireUser();
  const [row] = await db().select(nexconnUserColumns).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  if (!row) throw notFound("Account not found.");
  return row;
}

/**
 * Chat credentials for the signed-in user. Only the App Key (public) and the user's own token
 * are returned. Tokens issued under a previous App Key are replaced transparently.
 */
export const GET = handle(async () => {
  const row = await me();
  const token = await chatToken(row);
  return NextResponse.json(
    { appKey: env().NEXCONN_APP_KEY, userId: row.nexconnId, token, name: row.name },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/** Called by the client after a connect failure with an invalid/expired token (31004). */
export const POST = handle(async () => {
  const row = await me();
  await rateLimit(`token-refresh:${row.id}`, 5, 600);
  const token = await reissueToken(row);
  return NextResponse.json(
    { appKey: env().NEXCONN_APP_KEY, userId: row.nexconnId, token, name: row.name },
    { headers: { "Cache-Control": "no-store" } },
  );
});
