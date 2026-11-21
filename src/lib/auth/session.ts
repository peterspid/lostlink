import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { User } from "@/lib/db/schema";

export const SESSION_COOKIE = "llk_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function key() {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function readUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = Pick<User, "id" | "name" | "email" | "nexconnId" | "karma" | "returnedCount">;

/** Current signed-in user, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const id = await readUserId();
  if (!id) return null;
  const [u] = await db()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      nexconnId: schema.users.nexconnId,
      karma: schema.users.karma,
      returnedCount: schema.users.returnedCount,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return u ?? null;
}
