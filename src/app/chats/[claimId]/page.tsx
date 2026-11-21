import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { getClaim } from "@/lib/claims";
import { getItem } from "@/lib/items";
import { buildClaimView } from "@/lib/claim-view";
import { ChatRoom } from "@/components/chat/chat-room";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ params, searchParams }: PageProps<"/chats/[claimId]">) {
  const { claimId } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/chats/${claimId}`)}`);
  const claim = await getClaim(claimId);
  if (!claim || (claim.claimantId !== me.id && claim.finderId !== me.id)) notFound();
  const item = await getItem(claim.itemId);
  if (!item) notFound();
  const view = await buildClaimView(claim, item, me.id);
  return <ChatRoom initial={view} justClaimed={sp.claimed === "1"} />;
}
