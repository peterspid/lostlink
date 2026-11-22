import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { conflict, handle, parseJson } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { newId, nexconnId } from "@/lib/ids";
import { issueAccessToken } from "@/lib/nexconn/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { signupSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await rateLimit(`signup:${clientIp(req)}`, 10, 600, "Too many sign-ups from this network. Try again in a few minutes.");
  const input = await parseJson(req, signupSchema);
  const [existing] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
  if (existing) throw conflict("An account with this email already exists. Sign in instead.");

  const id = newId();
  const ncId = nexconnId(env().NEXCONN_ID_PREFIX);
  // Registers the user with Nexconn and returns a permanent access token. If Nexconn is
  // unreachable the account is still created; /api/nexconn/token issues the token later.
  const token = await issueAccessToken(ncId, input.name).catch((err) => {
    console.error("[signup] nexconn token issue failed", err);
    return null;
  });
  const passwordHash = await bcrypt.hash(input.password, 11);
  await db().insert(schema.users).values({
    id,
    nexconnId: ncId,
    nexconnToken: token,
    nexconnAppKey: token ? env().NEXCONN_APP_KEY : null,
    email: input.email,
    passwordHash,
    name: input.name,
  });
  await createSession(id);
  return NextResponse.json({ ok: true, user: { id, name: input.name } }, { status: 201 });
});
