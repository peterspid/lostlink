import "server-only";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { MSG, type NoticeContent } from "@/lib/nexconn/messages";
import { sendSystemMessage } from "@/lib/nexconn/server";

/**
 * Deliver a notification: persist it for the in-app notification center and push it
 * through the Nexconn system channel (server-sent, recipients cannot reply).
 */
export async function notify(userIds: string[], notice: NoticeContent) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await db()
    .insert(schema.notifications)
    .values(ids.map((userId) => ({ id: newId(), userId, kind: notice.kind, title: notice.title, body: notice.body, href: notice.href })));
  try {
    const rows = await db()
      .select({ nexconnId: schema.users.nexconnId })
      .from(schema.users)
      .where(inArray(schema.users.id, ids));
    await sendSystemMessage(
      rows.map((r) => r.nexconnId),
      MSG.NOTICE,
      notice as unknown as Record<string, unknown>,
      `${notice.title}: ${notice.body}`.slice(0, 200),
    );
  } catch (err) {
    // The in-app notification is already stored; realtime delivery is best effort.
    console.error("[notify] system message failed", err);
  }
}
