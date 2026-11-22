import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { currentUser } from "@/lib/auth/session";
import { listClaimsFor } from "@/lib/claim-view";
import { myDesks } from "@/lib/desks";
import { ChatList } from "@/components/chat/chat-list";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/chats");
  const [claims, desks] = await Promise.all([listClaimsFor(me.id), myDesks(me.id)]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader icon={<MessagesSquare />} title="Chats" description="Private conversations about claims and handovers. Nobody sees your phone number." />
      <div className="mt-8">
        <ChatList claims={claims} desks={desks.map((d) => ({ id: d.desk.id, slug: d.desk.slug, name: d.desk.name, groupId: d.desk.nexconnGroupId }))} />
      </div>
    </div>
  );
}
