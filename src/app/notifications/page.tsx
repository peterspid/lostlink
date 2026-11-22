import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/notifications");
  const n = schema.notifications;
  const rows = await db()
    .select({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })
    .from(n)
    .where(eq(n.userId, me.id))
    .orderBy(desc(n.createdAt))
    .limit(50);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader icon={<Bell />} title="Notifications" description="Matches, claims and handover updates. They also pop up live while you use LostLink." />
      <div className="mt-8">
        <NotificationList
          initial={rows.map((r) => ({ ...r, readAt: r.readAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
