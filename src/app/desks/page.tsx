import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { currentUser } from "@/lib/auth/session";
import { DESK_KINDS, myDesks } from "@/lib/desks";
import { EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Your desks" };

export default async function DesksPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/desks");
  const desks = await myDesks(me.id);
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Lost & found desks</h1>
        <LinkButton href="/desks/new" variant="signal" icon={<Plus className="size-4" aria-hidden />}>
          New desk
        </LinkButton>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {desks.length === 0 ? (
          <EmptyState icon={<Building2 className="size-5" />} title="You don't run a desk yet">
            Create one for your campus, mall, station or event. You get a public page, a QR poster and a staff chat.
          </EmptyState>
        ) : (
          desks.map((d) => (
            <Link key={d.desk.id} href={`/desks/${d.desk.slug}/manage`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:border-ink">
              <Building2 className="size-5" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold">{d.desk.name}</span>
                <span className="text-sm text-ink-2">{DESK_KINDS[d.desk.kind as keyof typeof DESK_KINDS] ?? "Desk"}, {d.desk.placeLabel}</span>
              </span>
              <span className="text-sm text-ink-2">{d.role === "owner" ? "Owner" : "Staff"}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
