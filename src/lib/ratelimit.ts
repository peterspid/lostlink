import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSec: number,
  ) {
    super(message);
  }
}

/**
 * Fixed-window rate limit stored in Postgres (works across serverless instances).
 * Throws RateLimitError when `limit` is exceeded within `windowSec`.
 */
export async function rateLimit(key: string, limit: number, windowSec: number, message?: string) {
  const now = new Date();
  const rows = await db()
    .insert(schema.rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`CASE WHEN ${schema.rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) THEN 1 ELSE ${schema.rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${schema.rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) THEN now() ELSE ${schema.rateLimits.windowStart} END`,
      },
    })
    .returning({ count: schema.rateLimits.count, windowStart: schema.rateLimits.windowStart });
  const row = rows[0];
  if (row && row.count > limit) {
    const elapsed = (now.getTime() - new Date(row.windowStart).getTime()) / 1000;
    const retry = Math.max(1, Math.ceil(windowSec - elapsed));
    throw new RateLimitError(message ?? `Too many attempts. Try again in ${retry} seconds.`, retry);
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
