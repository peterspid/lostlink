import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Claim, ClaimAnswer, HandoverPlan, Item } from "@/lib/db/schema";
import { conflict, forbidden, notFound, badRequest } from "@/lib/api";
import { blockedBetween, firstName, getItem, isDeskStaff } from "@/lib/items";
import { newId } from "@/lib/ids";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";
import { MSG, type ClaimCardContent, type ClaimResultContent, type HandoverCardContent } from "@/lib/nexconn/messages";
import { sendDirectMessage, sendGroupMessage, setDirectMessageMetadata } from "@/lib/nexconn/server";
import { ensureRegistered, nexconnUserColumns } from "@/lib/nexconn/users";
import { ensureDeskGroup } from "@/lib/desks";
export { answerLooksRight } from "@/lib/text-match";

export const KARMA_PER_RETURN = 10;

interface Party {
  id: string;
  name: string;
  nexconnId: string;
}

/** Load a participant, registering them with Nexconn first if their token predates the current App Key. */
async function party(id: string): Promise<Party> {
  const [u] = await db().select(nexconnUserColumns).from(schema.users).where(eq(schema.users.id, id));
  if (!u) throw notFound("User not found.");
  await ensureRegistered([u]);
  return { id: u.id, name: u.name, nexconnId: u.nexconnId };
}

export async function getClaim(id: string): Promise<Claim | null> {
  const [c] = await db().select().from(schema.claims).where(eq(schema.claims.id, id)).limit(1);
  return c ?? null;
}

/** Load a claim the user participates in (claimant or finder), else 404/403. */
export async function claimForParticipant(id: string, userId: string) {
  const claim = await getClaim(id);
  if (!claim) throw notFound("This claim doesn't exist.");
  if (claim.claimantId !== userId && claim.finderId !== userId) throw forbidden();
  const item = await getItem(claim.itemId);
  if (!item) throw notFound("The item was removed.");
  return { claim, item, role: claim.finderId === userId ? ("finder" as const) : ("owner" as const) };
}

export async function createClaim(
  claimantId: string,
  input: { itemId: string; lostItemId?: string | null; answers: { questionId: string; answer: string }[]; note: string },
) {
  const item = await getItem(input.itemId);
  if (!item || item.status === "hidden") throw notFound("This item is no longer listed.");
  if (item.kind !== "found") throw badRequest("You can only claim found items.");
  if (item.status !== "open") throw conflict("This item has already been claimed or returned.");
  if (item.ownerId === claimantId || (await isDeskStaff(item.deskId, claimantId)))
    throw badRequest("You logged this item, so you can't claim it.");

  const blocks = await blockedBetween(item.ownerId, claimantId);
  if (blocks.aBlockedB || blocks.bBlockedA) throw forbidden("You can't claim this item.");

  const [existing] = await db()
    .select({ id: schema.claims.id, status: schema.claims.status })
    .from(schema.claims)
    .where(and(eq(schema.claims.itemId, item.id), eq(schema.claims.claimantId, claimantId), inArray(schema.claims.status, ["pending", "approved"])))
    .limit(1);
  if (existing) throw conflict(`You already have a ${existing.status} claim on this item.`);

  const [{ rejected }] = await db()
    .select({ rejected: sql<number>`count(*)::int` })
    .from(schema.claims)
    .where(and(eq(schema.claims.itemId, item.id), eq(schema.claims.claimantId, claimantId), eq(schema.claims.status, "rejected")));
  if (rejected >= 2) throw forbidden("The finder declined your previous claims on this item.");
  await rateLimit(`claim:${claimantId}`, 10, 3600, "You've made a lot of claims this hour. Try again later.");

  const questions = await db()
    .select()
    .from(schema.verificationQuestions)
    .where(eq(schema.verificationQuestions.itemId, item.id))
    .orderBy(asc(schema.verificationQuestions.position));
  const answers: ClaimAnswer[] = questions.map((q) => {
    const a = input.answers.find((x) => x.questionId === q.id)?.answer?.trim();
    if (!a) throw badRequest("Answer every question so the finder can check it's yours.");
    return { questionId: q.id, question: q.question, answer: a.slice(0, 200) };
  });

  let lostItemId: string | null = null;
  if (input.lostItemId) {
    const lost = await getItem(input.lostItemId);
    if (lost && lost.ownerId === claimantId && lost.kind === "lost") lostItemId = lost.id;
  }

  const claimant = await party(claimantId);
  const finder = await party(item.ownerId);
  const id = newId();
  await db().insert(schema.claims).values({
    id,
    itemId: item.id,
    lostItemId,
    claimantId,
    finderId: finder.id,
    answers,
    note: input.note,
  });

  // Claim card (custom message) into the claimant <-> finder direct channel. Its state lives in metadata.
  const card: ClaimCardContent = {
    claimId: id,
    itemId: item.id,
    itemCode: item.code,
    itemTitle: item.title,
    itemPhoto: item.photos[0],
    claimantName: firstName(claimant.name),
    questionCount: answers.length,
    note: input.note || undefined,
  };
  const messageId = await sendDirectMessage({
    fromUserId: claimant.nexconnId,
    toUserId: finder.nexconnId,
    messageType: MSG.CLAIM,
    content: card as unknown as Record<string, unknown>,
    pushContent: `${firstName(claimant.name)} says "${item.title}" is theirs`,
    metadata: { status: "pending" },
  });
  if (messageId) await db().update(schema.claims).set({ cardMessageId: messageId }).where(eq(schema.claims.id, id));

  await notify([finder.id], {
    kind: "claim",
    title: `${firstName(claimant.name)} says "${item.title}" is theirs`,
    body: "Check their answers and approve or decline.",
    href: `/chats/${id}`,
  });
  if (item.deskId) await deskNotice(item, `New claim on "${item.title}"`, `${firstName(claimant.name)} answered ${answers.length} question(s). Ref ${item.code}.`, `/chats/${id}`);
  return { id };
}

async function deskNotice(item: Item, title: string, body: string, href: string) {
  const [desk] = await db().select().from(schema.desks).where(eq(schema.desks.id, item.deskId!));
  if (!desk) return;
  await ensureDeskGroup(desk)
    .then(() => sendGroupMessage(desk.nexconnGroupId, MSG.DESK, { deskId: desk.id, title, body, href }, title))
    .catch((err) => console.error("[claims] desk notice failed", err));
}

async function setCardStatus(claim: Claim, operator: Party, other: Party, status: string) {
  if (!claim.cardMessageId) return;
  await setDirectMessageMetadata(claim.cardMessageId, operator.nexconnId, other.nexconnId, { status }).catch((err) =>
    console.error("[claims] metadata update failed", err),
  );
}

export async function decideClaim(userId: string, claimId: string, approve: boolean, note: string) {
  const { claim, item, role } = await claimForParticipant(claimId, userId);
  if (role !== "finder") throw forbidden("Only the finder can approve or decline.");
  if (claim.status !== "pending") throw conflict(`This claim is already ${claim.status}.`);
  if (approve && item.status !== "open") throw conflict("This item has already been claimed by someone else.");

  const status = approve ? "approved" : "rejected";
  await db().update(schema.claims).set({ status, decidedAt: new Date(), decisionNote: note }).where(eq(schema.claims.id, claim.id));
  if (approve) await db().update(schema.items).set({ status: "claimed", updatedAt: new Date() }).where(eq(schema.items.id, item.id));

  const finder = await party(claim.finderId);
  const claimant = await party(claim.claimantId);
  await setCardStatus(claim, finder, claimant, status);

  const result: ClaimResultContent = { claimId: claim.id, itemCode: item.code, itemTitle: item.title, approved: approve, note: note || undefined };
  await sendDirectMessage({
    fromUserId: finder.nexconnId,
    toUserId: claimant.nexconnId,
    messageType: MSG.RESULT,
    content: result as unknown as Record<string, unknown>,
    pushContent: approve ? `Your claim for "${item.title}" was approved` : `Your claim for "${item.title}" was declined`,
  }).catch((err) => console.error("[claims] result card failed", err));

  await notify([claimant.id], {
    kind: "decision",
    title: approve ? `Claim approved: ${item.title}` : `Claim declined: ${item.title}`,
    body: approve ? "Chat with the finder to arrange the handover." : note || "The finder didn't recognise your answers.",
    href: `/chats/${claim.id}`,
  });
  return { status };
}

export async function proposeHandover(userId: string, claimId: string, plan: { lat: number; lng: number; label: string; at: Date }) {
  const { claim, item, role } = await claimForParticipant(claimId, userId);
  if (claim.status !== "approved") throw conflict("Arrange a handover after the claim is approved.");
  const me = await party(userId);
  const other = await party(role === "finder" ? claim.claimantId : claim.finderId);

  // Mark the previous proposal as superseded.
  if (claim.handover?.messageId && claim.handover.status === "proposed") {
    const prevProposer = claim.handover.proposedBy === me.id ? me : other;
    const prevOther = prevProposer.id === me.id ? other : me;
    await setDirectMessageMetadata(claim.handover.messageId, prevOther.nexconnId, prevProposer.nexconnId, { status: "superseded" }).catch(() => undefined);
  }

  const content: HandoverCardContent = {
    claimId: claim.id,
    itemCode: item.code,
    label: plan.label,
    lat: plan.lat,
    lng: plan.lng,
    at: plan.at.toISOString(),
    proposedByName: firstName(me.name),
  };
  const messageId = await sendDirectMessage({
    fromUserId: me.nexconnId,
    toUserId: other.nexconnId,
    messageType: MSG.HANDOVER,
    content: content as unknown as Record<string, unknown>,
    pushContent: `${firstName(me.name)} proposed a handover at ${plan.label}`,
    metadata: { status: "proposed" },
  });
  const handover: HandoverPlan = {
    lat: plan.lat,
    lng: plan.lng,
    label: plan.label,
    at: plan.at.toISOString(),
    proposedBy: me.id,
    status: "proposed",
    messageId: messageId ?? undefined,
  };
  await db().update(schema.claims).set({ handover }).where(eq(schema.claims.id, claim.id));
  await notify([other.id], {
    kind: "handover",
    title: `Handover proposed for "${item.title}"`,
    body: `${firstName(me.name)} suggested ${plan.label}.`,
    href: `/chats/${claim.id}`,
  });
  return handover;
}

export async function respondHandover(userId: string, claimId: string, action: "accept" | "decline") {
  const { claim, item } = await claimForParticipant(claimId, userId);
  const h = claim.handover;
  if (!h || h.status !== "proposed") throw conflict("There's no open handover proposal.");
  if (h.proposedBy === userId) throw badRequest("Wait for the other person to respond to your proposal.");
  const status = action === "accept" ? "accepted" : "declined";
  const me = await party(userId);
  const proposer = await party(h.proposedBy);
  if (h.messageId) {
    await setDirectMessageMetadata(h.messageId, me.nexconnId, proposer.nexconnId, { status }).catch((err) =>
      console.error("[claims] handover metadata failed", err),
    );
  }
  const handover: HandoverPlan = { ...h, status };
  await db().update(schema.claims).set({ handover }).where(eq(schema.claims.id, claim.id));
  await notify([proposer.id], {
    kind: "handover",
    title: action === "accept" ? `Handover confirmed: ${h.label}` : "Handover time declined",
    body: action === "accept" ? `${firstName(me.name)} will meet you there for "${item.title}".` : `${firstName(me.name)} asked for a different time or place.`,
    href: `/chats/${claim.id}`,
  });
  return handover;
}

export async function confirmReturned(userId: string, claimId: string) {
  const { claim, item, role } = await claimForParticipant(claimId, userId);
  if (claim.status === "returned") return { status: "returned" as const, both: true };
  if (claim.status !== "approved") throw conflict("Only approved claims can be marked returned.");
  const now = new Date();
  const patch = role === "finder" ? { finderReturnedAt: now } : { ownerReturnedAt: now };
  const [updated] = await db().update(schema.claims).set(patch).where(eq(schema.claims.id, claim.id)).returning();
  const both = !!updated.finderReturnedAt && !!updated.ownerReturnedAt;
  const me = await party(userId);
  const otherId = role === "finder" ? claim.claimantId : claim.finderId;

  if (!both) {
    await notify([otherId], {
      kind: "returned",
      title: `${firstName(me.name)} marked "${item.title}" as returned`,
      body: "Confirm on your side to close it.",
      href: `/chats/${claim.id}`,
    });
    return { status: "approved" as const, both: false };
  }

  await db().update(schema.claims).set({ status: "returned" }).where(eq(schema.claims.id, claim.id));
  await db().update(schema.items).set({ status: "returned", updatedAt: now }).where(eq(schema.items.id, item.id));
  if (claim.lostItemId) await db().update(schema.items).set({ status: "returned", updatedAt: now }).where(eq(schema.items.id, claim.lostItemId));
  await db()
    .update(schema.users)
    .set({ karma: sql`${schema.users.karma} + ${KARMA_PER_RETURN}`, returnedCount: sql`${schema.users.returnedCount} + 1` })
    .where(eq(schema.users.id, claim.finderId));
  // Other open claims on this item can no longer succeed.
  await db()
    .update(schema.claims)
    .set({ status: "rejected", decisionNote: "The item was returned to its owner.", decidedAt: now })
    .where(and(eq(schema.claims.itemId, item.id), ne(schema.claims.id, claim.id), eq(schema.claims.status, "pending")));

  const finder = await party(claim.finderId);
  const claimant = await party(claim.claimantId);
  await setCardStatus(claim, finder, claimant, "returned");
  if (claim.handover?.messageId) {
    await setDirectMessageMetadata(claim.handover.messageId, finder.nexconnId, claimant.nexconnId, { status: "returned" }).catch(() => undefined);
  }
  await notify([claim.finderId], {
    kind: "returned",
    title: `"${item.title}" is back with its owner`,
    body: `You earned ${KARMA_PER_RETURN} karma. Thank you for handing it in.`,
    href: `/chats/${claim.id}`,
  });
  await notify([claim.claimantId], {
    kind: "returned",
    title: `"${item.title}" is marked returned`,
    body: "Leave the finder a thank-you note.",
    href: `/chats/${claim.id}`,
  });
  if (item.deskId) await deskNotice(item, `"${item.title}" was returned`, `Ref ${item.code} is closed.`, `/items/${item.id}`);
  return { status: "returned" as const, both: true };
}

export async function leaveThanks(userId: string, claimId: string, text: string) {
  const { claim, item, role } = await claimForParticipant(claimId, userId);
  if (role !== "owner") throw forbidden("Only the owner can leave a thank-you note.");
  if (claim.status !== "returned") throw conflict("You can thank the finder once the item is returned.");
  if (claim.thankYou) throw conflict("You already left a note.");
  await db().update(schema.claims).set({ thankYou: text }).where(eq(schema.claims.id, claim.id));
  const me = await party(userId);
  await notify([claim.finderId], {
    kind: "returned",
    title: `${firstName(me.name)} thanked you`,
    body: `"${text.slice(0, 120)}" — for "${item.title}"`,
    href: `/profile`,
  });
}

export async function cancelClaim(userId: string, claimId: string) {
  const { claim, item, role } = await claimForParticipant(claimId, userId);
  if (role !== "owner") throw forbidden("Only the person who made the claim can withdraw it.");
  if (!["pending", "approved"].includes(claim.status)) throw conflict(`This claim is already ${claim.status}.`);
  await db().update(schema.claims).set({ status: "cancelled" }).where(eq(schema.claims.id, claim.id));
  if (claim.status === "approved") await db().update(schema.items).set({ status: "open" }).where(eq(schema.items.id, item.id));
  const claimant = await party(claim.claimantId);
  const finder = await party(claim.finderId);
  await setCardStatus(claim, claimant, finder, "cancelled");
  await notify([claim.finderId], {
    kind: "claim",
    title: `${firstName(claimant.name)} withdrew their claim`,
    body: `"${item.title}" is listed again.`,
    href: `/items/${item.id}`,
  });
}
