import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { addToBlocklist, issueAccessToken } from "@/lib/nexconn/server";

/**
 * Nexconn users exist per App Key. Each stored token remembers the key that issued it, so
 * swapping NEXCONN_APP_KEY re-registers people lazily the next time they connect or are
 * messaged, instead of failing with "user not found" or an invalid token.
 */
export interface NexconnUser {
  id: string;
  name: string;
  nexconnId: string;
  nexconnToken: string | null;
  nexconnAppKey: string | null;
}

export const nexconnUserColumns = {
  id: schema.users.id,
  name: schema.users.name,
  nexconnId: schema.users.nexconnId,
  nexconnToken: schema.users.nexconnToken,
  nexconnAppKey: schema.users.nexconnAppKey,
};

export function isRegistered(u: Pick<NexconnUser, "nexconnToken" | "nexconnAppKey">): boolean {
  return !!u.nexconnToken && u.nexconnAppKey === env().NEXCONN_APP_KEY;
}

/** Issue (and register) a fresh token under the current App Key and store it. */
export async function reissueToken(u: Pick<NexconnUser, "id" | "nexconnId" | "name" | "nexconnAppKey">): Promise<string> {
  const appKey = env().NEXCONN_APP_KEY;
  const token = await issueAccessToken(u.nexconnId, u.name);
  await db().update(schema.users).set({ nexconnToken: token, nexconnAppKey: appKey }).where(eq(schema.users.id, u.id));
  if (u.nexconnAppKey !== appKey) await syncBlocklist(u).catch((err) => console.error("[nexconn] blocklist sync failed", err));
  return token;
}

/** A newly registered user starts with an empty Nexconn blocklist: copy their blocks from Postgres. */
async function syncBlocklist(u: Pick<NexconnUser, "id" | "nexconnId">) {
  const rows = await db()
    .select({ nexconnId: schema.users.nexconnId })
    .from(schema.blocks)
    .innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedId))
    .where(eq(schema.blocks.blockerId, u.id));
  if (rows.length) await addToBlocklist(u.nexconnId, rows.map((r) => r.nexconnId));
}

/** The user's chat token, re-issued when missing or issued under another App Key. */
export async function chatToken(u: NexconnUser): Promise<string> {
  return isRegistered(u) ? u.nexconnToken! : reissueToken(u);
}

/** Make sure these users exist under the current App Key before the server messages them. */
export async function ensureRegistered(rows: NexconnUser[]): Promise<void> {
  await Promise.all(rows.filter((u) => !isRegistered(u)).map((u) => reissueToken(u)));
}

export async function ensureRegisteredIds(userIds: string[]): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const rows = await db().select(nexconnUserColumns).from(schema.users).where(inArray(schema.users.id, ids));
  await ensureRegistered(rows);
}
