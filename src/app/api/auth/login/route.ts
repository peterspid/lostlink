import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError, handle, parseJson } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/validation";

// Constant-time-ish failure path: compare against a dummy hash when the email is unknown.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 11));

export const POST = handle(async (req: Request) => {
  await rateLimit(`login:${clientIp(req)}`, 20, 600, "Too many sign-in attempts. Try again in a few minutes.");
  const input = await parseJson(req, loginSchema);
  await rateLimit(`login-email:${input.email}`, 10, 600, "Too many attempts for this account. Try again in a few minutes.");
  const [user] = await db().select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok) throw new HttpError(401, "Email or password is incorrect.");
  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name } });
});
