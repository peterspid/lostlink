import { NextResponse } from "next/server";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError, handle } from "@/lib/api";
import { notify } from "@/lib/notify";
import { DAY_MS } from "@/lib/time";

/**
 * Daily job (Vercel cron): posts expire after 60 days. Owners get a renew prompt 5 days
 * before, and a notice when the post expires.
 */
export const GET = handle(async (req: Request) => {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized");
  const now = new Date();
  const t = schema.items;

  const soon = await db()
    .select({ id: t.id, ownerId: t.ownerId, title: t.title })
    .from(t)
    .where(and(eq(t.status, "open"), lt(t.expiresAt, new Date(now.getTime() + 5 * DAY_MS)), isNull(t.renewPromptedAt)))
    .limit(500);
  for (const it of soon) {
    await db().update(t).set({ renewPromptedAt: now }).where(eq(t.id, it.id));
    await notify([it.ownerId], {
      kind: "expiry",
      title: `"${it.title}" expires in 5 days`,
      body: "Renew it to keep it visible and keep matching.",
      href: `/items/${it.id}`,
    });
  }

  const expired = await db()
    .update(t)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(t.status, "open"), lt(t.expiresAt, now)))
    .returning({ id: t.id, ownerId: t.ownerId, title: t.title });
  for (const it of expired) {
    await notify([it.ownerId], {
      kind: "expiry",
      title: `"${it.title}" has expired`,
      body: "It's hidden from search. Renew it if you're still looking.",
      href: `/items/${it.id}`,
    });
  }
  return NextResponse.json({ prompted: soon.length, expired: expired.length });
});
