import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Desk } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/api";
import { newId, newToken, nexconnId } from "@/lib/ids";
import { createGroup, joinGroup, leaveGroup, sendGroupMessage } from "@/lib/nexconn/server";
import { MSG } from "@/lib/nexconn/messages";
import { firstName } from "@/lib/items";

export const DESK_KINDS = {
  campus: "Campus",
  mall: "Mall",
  station: "Station",
  event: "Event",
  office: "Office",
  other: "Other",
} as const;

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "desk"}-${newId().slice(0, 5)}`;
}

export async function createDesk(
  owner: { id: string; nexconnId: string; name: string },
  input: { name: string; kind: string; description: string; hours: string; placeLabel: string; lat: number; lng: number },
): Promise<Desk> {
  const id = newId();
  const groupId = nexconnId(env().NEXCONN_ID_PREFIX);
  // Staff coordination happens in a Nexconn group channel owned by the desk creator.
  await createGroup(groupId, `${input.name} staff`, owner.nexconnId, `Lost & found desk staff for ${input.name}`);
  const [desk] = await db()
    .insert(schema.desks)
    .values({
      id,
      slug: slugify(input.name),
      name: input.name,
      kind: input.kind,
      description: input.description,
      hours: input.hours,
      placeLabel: input.placeLabel,
      lat: input.lat,
      lng: input.lng,
      ownerId: owner.id,
      nexconnGroupId: groupId,
      inviteToken: newToken(),
    })
    .returning();
  await db().insert(schema.deskMembers).values({ deskId: id, userId: owner.id, role: "owner" });
  await sendGroupMessage(
    groupId,
    MSG.DESK,
    { deskId: id, title: `${input.name} desk is open`, body: "Log items here and coordinate claims with your team.", href: `/desks/${desk.slug}/manage` },
    `${input.name} desk created`,
  ).catch(() => undefined);
  return desk;
}

export async function getDeskBySlug(slug: string): Promise<Desk | null> {
  const [d] = await db().select().from(schema.desks).where(eq(schema.desks.slug, slug)).limit(1);
  return d ?? null;
}

export async function getDesk(id: string): Promise<Desk | null> {
  const [d] = await db().select().from(schema.desks).where(eq(schema.desks.id, id)).limit(1);
  return d ?? null;
}

export async function deskRole(deskId: string, userId: string): Promise<"owner" | "staff" | null> {
  const [m] = await db()
    .select({ role: schema.deskMembers.role })
    .from(schema.deskMembers)
    .where(and(eq(schema.deskMembers.deskId, deskId), eq(schema.deskMembers.userId, userId)))
    .limit(1);
  return (m?.role as "owner" | "staff" | undefined) ?? null;
}

export async function deskMembers(deskId: string) {
  return db()
    .select({ userId: schema.users.id, name: schema.users.name, nexconnId: schema.users.nexconnId, role: schema.deskMembers.role, joinedAt: schema.deskMembers.createdAt })
    .from(schema.deskMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.deskMembers.userId))
    .where(eq(schema.deskMembers.deskId, deskId))
    .orderBy(asc(schema.deskMembers.createdAt));
}

export async function myDesks(userId: string) {
  return db()
    .select({ desk: schema.desks, role: schema.deskMembers.role })
    .from(schema.deskMembers)
    .innerJoin(schema.desks, eq(schema.desks.id, schema.deskMembers.deskId))
    .where(eq(schema.deskMembers.userId, userId))
    .orderBy(asc(schema.desks.name));
}

export async function joinDeskByToken(user: { id: string; nexconnId: string; name: string }, token: string): Promise<Desk> {
  const [desk] = await db().select().from(schema.desks).where(eq(schema.desks.inviteToken, token)).limit(1);
  if (!desk) throw notFound("This invite link is no longer valid. Ask the desk owner for a new one.");
  const role = await deskRole(desk.id, user.id);
  if (role) return desk;
  await joinGroup(desk.nexconnGroupId, [user.nexconnId]);
  await db().insert(schema.deskMembers).values({ deskId: desk.id, userId: user.id, role: "staff" }).onConflictDoNothing();
  await sendGroupMessage(
    desk.nexconnGroupId,
    MSG.DESK,
    { deskId: desk.id, title: `${firstName(user.name)} joined the desk team`, body: "Say hello and share the shift plan.", href: `/desks/${desk.slug}/manage` },
    `${firstName(user.name)} joined ${desk.name}`,
  ).catch(() => undefined);
  return desk;
}

export async function removeStaff(ownerId: string, deskId: string, userId: string) {
  const desk = await getDesk(deskId);
  if (!desk) throw notFound();
  if (desk.ownerId !== ownerId) throw forbidden("Only the desk owner can remove staff.");
  if (userId === ownerId) throw conflict("The owner can't be removed.");
  const [u] = await db().select({ nexconnId: schema.users.nexconnId }).from(schema.users).where(eq(schema.users.id, userId));
  if (!u) throw notFound();
  await db().delete(schema.deskMembers).where(and(eq(schema.deskMembers.deskId, deskId), eq(schema.deskMembers.userId, userId)));
  await leaveGroup(desk.nexconnGroupId, [u.nexconnId]).catch(() => undefined);
}

export async function rotateInvite(ownerId: string, deskId: string) {
  const desk = await getDesk(deskId);
  if (!desk) throw notFound();
  if (desk.ownerId !== ownerId) throw forbidden("Only the desk owner can reset the invite link.");
  const token = newToken();
  await db().update(schema.desks).set({ inviteToken: token }).where(eq(schema.desks.id, deskId));
  return token;
}
