import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, MapPin, Plus } from "lucide-react";
import { currentUser } from "@/lib/auth/session";
import { DESK_KINDS, myDesks } from "@/lib/desks";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Your desks" };

export default async function DesksPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/desks");
  const desks = await myDesks(me.id);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        icon={<Building2 />}
        title="Lost & found desks"
        description="Desks you own or staff. Each one has a public page, a QR poster, an inventory and a staff chat."
        actions={
          <LinkButton href="/desks/new" variant="signal" icon={<Plus className="size-4" aria-hidden />}>
            New desk
          </LinkButton>
        }
      />
      <div className="mt-8 flex flex-col gap-3">
        {desks.length === 0 ? (
          <EmptyState icon={<Building2 />} title="You don't run a desk yet" action={<LinkButton href="/desks/new">Set up a desk</LinkButton>}>
            Create one for your campus, mall, station or event. You get a public page, a QR poster and a staff chat.
          </EmptyState>
        ) : (
          desks.map((d) => (
            <Link
              key={d.desk.id}
              href={`/desks/${d.desk.slug}/manage`}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-ink/50 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-signal text-ink" aria-hidden>
                <Building2 className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[17px] font-extrabold">{d.desk.name}</span>
                <span className="flex items-center gap-1 truncate text-sm text-ink-2">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {DESK_KINDS[d.desk.kind as keyof typeof DESK_KINDS] ?? "Desk"}, {d.desk.placeLabel}
                </span>
              </span>
              <span className={d.role === "owner" ? "rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-signal" : "rounded-full bg-wash px-2.5 py-0.5 text-xs font-bold text-ink-2"}>
                {d.role === "owner" ? "Owner" : "Staff"}
              </span>
              <ChevronRight className="size-5 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
