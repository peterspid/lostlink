import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, EyeOff, MessagesSquare, ShieldCheck } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { canManageItem, getItem } from "@/lib/items";
import { ClaimForm } from "@/components/claim-form";
import { Thumb } from "@/components/item-tag";
import { Banner, KindMark } from "@/components/ui";

export const metadata: Metadata = { title: "Claim an item" };

export default async function ClaimPage({ params, searchParams }: PageProps<"/items/[id]/claim">) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/items/${id}/claim`)}`);
  const item = await getItem(id);
  if (!item || item.status === "hidden" || item.kind !== "found") notFound();
  if (await canManageItem(item, me.id)) redirect(`/items/${id}`);

  const [existing] = await db()
    .select({ id: schema.claims.id })
    .from(schema.claims)
    .where(and(eq(schema.claims.itemId, id), eq(schema.claims.claimantId, me.id), inArray(schema.claims.status, ["pending", "approved"])))
    .limit(1);
  if (existing) redirect(`/chats/${existing.id}`);

  const questions = await db()
    .select({ id: schema.verificationQuestions.id, question: schema.verificationQuestions.question })
    .from(schema.verificationQuestions)
    .where(eq(schema.verificationQuestions.itemId, id))
    .orderBy(asc(schema.verificationQuestions.position));
  const myLost = await db()
    .select({ id: schema.items.id, title: schema.items.title, code: schema.items.code })
    .from(schema.items)
    .where(and(eq(schema.items.ownerId, me.id), eq(schema.items.kind, "lost"), eq(schema.items.status, "open")))
    .orderBy(desc(schema.items.createdAt))
    .limit(20);
  const from = typeof sp.from === "string" && myLost.some((l) => l.id === sp.from) ? sp.from : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <Link href={`/items/${id}`} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-wash hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to item
      </Link>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)]">
        <Thumb item={item} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KindMark kind="found" />
            <span className="ref-code text-xs text-ink-3">{item.code}</span>
          </div>
          <p className="truncate font-display font-bold">{item.title}</p>
        </div>
      </div>
      <h1 className="mt-8 text-[34px] font-black leading-[1.05] md:text-[40px]">Show it&apos;s yours</h1>
      <p className="mt-2 text-[17px] text-ink-2">The finder compares your answers with what they can see. Be specific: details only the owner would know.</p>
      <ol className="mt-5 grid gap-2 text-[14px] text-ink-2 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, text: "You answer their questions" },
          { icon: EyeOff, text: "Only the finder sees them" },
          { icon: MessagesSquare, text: "If approved, a private chat opens" },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2 rounded-xl bg-wash px-3 py-2">
            <Icon className="size-4 shrink-0 text-ink" aria-hidden />
            {text}
          </li>
        ))}
      </ol>
      {item.status !== "open" ? (
        <div className="mt-8">
          <Banner tone="info" title="This item can't be claimed right now">
            Someone else&apos;s claim was approved or it has been returned.
          </Banner>
        </div>
      ) : (
        <div className="mt-8">
          <ClaimForm itemId={id} questions={questions} myLost={myLost} defaultLostId={from} />
        </div>
      )}
    </div>
  );
}
