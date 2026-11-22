import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Boxes, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { deskRole } from "@/lib/desks";
import { JoinDeskButton } from "@/components/desk-forms";

export const metadata: Metadata = { title: "Join a desk team" };

export default async function JoinDeskPage({ params }: PageProps<"/desks/join/[token]">) {
  const { token } = await params;
  const me = await currentUser();
  if (!me) redirect(`/signup?next=${encodeURIComponent(`/desks/join/${token}`)}`);
  const [desk] = await db().select().from(schema.desks).where(eq(schema.desks.inviteToken, token)).limit(1);
  if (!desk) notFound();
  if (await deskRole(desk.id, me.id)) redirect(`/desks/${desk.slug}/manage`);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-[var(--shadow-float)]">
        <div className="bg-signal p-6">
          <span className="flex size-12 items-center justify-center rounded-xl bg-ink text-signal">
            <Users className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-[30px] font-black leading-tight">Join {desk.name}</h1>
          <p className="mt-1 text-ink/80">You&apos;ve been invited to the staff team.</p>
        </div>
        <div className="p-6">
          <ul className="flex flex-col gap-3 text-[15px] text-ink-2">
            {[
              { icon: Boxes, text: "Log found items into the desk inventory" },
              { icon: ShieldCheck, text: "Check claims and approve the real owners" },
              { icon: MessagesSquare, text: "Coordinate with the team in the staff chat" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-5 shrink-0 text-ink" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <JoinDeskButton token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
