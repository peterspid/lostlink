import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { AlertsManager } from "@/components/alerts-manager";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/alerts");
  const a = schema.alerts;
  const rows = await db()
    .select({ id: a.id, query: a.query, category: a.category, placeLabel: a.placeLabel, radiusM: a.radiusM, active: a.active, lastNotifiedAt: a.lastNotifiedAt })
    .from(a)
    .where(eq(a.userId, me.id))
    .orderBy(desc(a.createdAt));
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">Alerts</h1>
      <p className="mt-1 text-ink-2">Get notified the moment something like your lost item is handed in nearby.</p>
      <div className="mt-6">
        <AlertsManager initial={rows.map((r) => ({ ...r, lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null }))} />
      </div>
    </div>
  );
}
