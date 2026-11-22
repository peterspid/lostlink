import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Radar } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { AlertsManager } from "@/components/alerts-manager";
import { PageHeader } from "@/components/ui";

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader icon={<Radar />} title="Alerts" description="Save a search and get notified the moment something like it is handed in nearby." />
      <div className="mt-8">
        <AlertsManager initial={rows.map((r) => ({ ...r, lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null }))} />
      </div>
    </div>
  );
}
