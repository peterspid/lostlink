import "server-only";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Claim, Item } from "@/lib/db/schema";
import { answerLooksRight } from "@/lib/text-match";
import { blockedBetween, firstName } from "@/lib/items";

export interface ClaimView {
  id: string;
  status: Claim["status"];
  role: "owner" | "finder";
  createdAt: string;
  decidedAt: string | null;
  note: string;
  decisionNote: string;
  cardMessageId: string | null;
  handover: Claim["handover"];
  ownerReturned: boolean;
  finderReturned: boolean;
  thankYou: string | null;
  item: { id: string; code: string; title: string; photo: string | null; placeLabel: string; status: Item["status"]; deskId: string | null };
  other: { id: string; name: string; nexconnId: string; karma: number; returnedCount: number };
  me: { id: string; nexconnId: string; name: string };
  answers: { question: string; answer: string; expected?: string; looksRight?: boolean }[];
  blockedByMe: boolean;
  blockedMe: boolean;
}

export async function buildClaimView(claim: Claim, item: Item, viewerId: string): Promise<ClaimView> {
  const role = claim.finderId === viewerId ? "finder" : "owner";
  const otherId = role === "finder" ? claim.claimantId : claim.finderId;
  const people = await db()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      nexconnId: schema.users.nexconnId,
      karma: schema.users.karma,
      returnedCount: schema.users.returnedCount,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, [viewerId, otherId]));
  const other = people.find((p) => p.id === otherId)!;
  const me = people.find((p) => p.id === viewerId)!;
  let answers: ClaimView["answers"] = claim.answers.map((a) => ({ question: a.question, answer: a.answer }));
  if (role === "finder") {
    const qs = await db()
      .select()
      .from(schema.verificationQuestions)
      .where(eq(schema.verificationQuestions.itemId, item.id))
      .orderBy(asc(schema.verificationQuestions.position));
    answers = claim.answers.map((a) => {
      const q = qs.find((x) => x.id === a.questionId);
      return {
        question: a.question,
        answer: a.answer,
        expected: q?.answer,
        looksRight: q ? answerLooksRight(q.answer, a.answer) : undefined,
      };
    });
  }
  const blocks = await blockedBetween(viewerId, otherId);
  return {
    id: claim.id,
    status: claim.status,
    role,
    createdAt: claim.createdAt.toISOString(),
    decidedAt: claim.decidedAt?.toISOString() ?? null,
    note: claim.note,
    decisionNote: claim.decisionNote,
    cardMessageId: claim.cardMessageId,
    handover: claim.handover,
    ownerReturned: !!claim.ownerReturnedAt,
    finderReturned: !!claim.finderReturnedAt,
    thankYou: claim.thankYou,
    item: {
      id: item.id,
      code: item.code,
      title: item.title,
      photo: item.photos[0] ?? null,
      placeLabel: item.placeLabel,
      status: item.status,
      deskId: item.deskId,
    },
    other: {
      id: other.id,
      name: firstName(other.name),
      nexconnId: other.nexconnId,
      karma: other.karma,
      returnedCount: other.returnedCount,
    },
    me: { id: me.id, nexconnId: me.nexconnId, name: firstName(me.name) },
    answers,
    blockedByMe: blocks.aBlockedB,
    blockedMe: blocks.bBlockedA,
  };
}

export interface ClaimListEntry {
  id: string;
  status: Claim["status"];
  role: "owner" | "finder";
  itemTitle: string;
  itemCode: string;
  itemPhoto: string | null;
  otherName: string;
  otherNexconnId: string;
  createdAt: string;
}

export async function listClaimsFor(userId: string): Promise<ClaimListEntry[]> {
  const c = schema.claims;
  const rows = await db()
    .select({ claim: c, title: schema.items.title, code: schema.items.code, photos: schema.items.photos })
    .from(c)
    .innerJoin(schema.items, eq(schema.items.id, c.itemId))
    .where(or(eq(c.claimantId, userId), eq(c.finderId, userId)))
    .orderBy(desc(c.createdAt))
    .limit(100);
  const otherIds = rows.map((r) => (r.claim.finderId === userId ? r.claim.claimantId : r.claim.finderId));
  const people = otherIds.length
    ? await db()
        .select({ id: schema.users.id, name: schema.users.name, nexconnId: schema.users.nexconnId })
        .from(schema.users)
        .where(inArray(schema.users.id, otherIds))
    : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  return rows.map((r) => {
    const role = r.claim.finderId === userId ? ("finder" as const) : ("owner" as const);
    const other = byId.get(role === "finder" ? r.claim.claimantId : r.claim.finderId);
    return {
      id: r.claim.id,
      status: r.claim.status,
      role,
      itemTitle: r.title,
      itemCode: r.code,
      itemPhoto: r.photos[0] ?? null,
      otherName: firstName(other?.name ?? "Someone"),
      otherNexconnId: other?.nexconnId ?? "",
      createdAt: r.claim.createdAt.toISOString(),
    };
  });
}
