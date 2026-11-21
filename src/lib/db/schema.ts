import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMS = 768;

export type ItemKind = "lost" | "found";
export type ItemStatus = "open" | "claimed" | "returned" | "closed" | "expired" | "hidden";
export type ClaimStatus = "pending" | "approved" | "rejected" | "returned" | "cancelled";

export interface ItemAttributes {
  color?: string;
  brand?: string;
  material?: string;
  marks?: string[];
}

export interface ClaimAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface HandoverPlan {
  lat: number;
  lng: number;
  label: string;
  at: string; // ISO time
  proposedBy: string; // user id
  status: "proposed" | "accepted" | "declined";
  messageId?: string;
}

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  nexconnId: text("nexconn_id").notNull().unique(),
  nexconnToken: text("nexconn_token"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  karma: integer("karma").notNull().default(0),
  returnedCount: integer("returned_count").notNull().default(0),
  createdAt: createdAt(),
});

export const desks = pgTable("desks", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  description: text("description").notNull().default(""),
  hours: text("hours").notNull().default(""),
  placeLabel: text("place_label").notNull().default(""),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nexconnGroupId: text("nexconn_group_id").notNull().unique(),
  inviteToken: text("invite_token").notNull().unique(),
  createdAt: createdAt(),
});

export const deskMembers = pgTable(
  "desk_members",
  {
    deskId: text("desk_id").notNull().references(() => desks.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("staff"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.deskId, t.userId] }), index("desk_members_user_idx").on(t.userId)],
);

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deskId: text("desk_id").references(() => desks.id, { onDelete: "set null" }),
    kind: text("kind").$type<ItemKind>().notNull(),
    status: text("status").$type<ItemStatus>().notNull().default("open"),
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    attributes: jsonb("attributes").$type<ItemAttributes>().notNull().default({}),
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    publicLat: doublePrecision("public_lat").notNull(),
    publicLng: doublePrecision("public_lng").notNull(),
    placeLabel: text("place_label").notNull().default(""),
    occurredFrom: timestamp("occurred_from", { withTimezone: true }).notNull(),
    occurredTo: timestamp("occurred_to", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMS }),
    aiFilled: boolean("ai_filled").notNull().default(false),
    reportCount: integer("report_count").notNull().default(0),
    renewPromptedAt: timestamp("renew_prompted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("items_kind_status_idx").on(t.kind, t.status),
    index("items_owner_idx").on(t.ownerId),
    index("items_desk_idx").on(t.deskId),
    index("items_geo_idx").on(t.lat, t.lng),
    index("items_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const verificationQuestions = pgTable(
  "verification_questions",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("vq_item_idx").on(t.itemId)],
);

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    lostItemId: text("lost_item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    foundItemId: text("found_item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    similarity: real("similarity"),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    distanceM: integer("distance_m").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("matches_pair_idx").on(t.lostItemId, t.foundItemId),
    index("matches_found_idx").on(t.foundItemId),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    lostItemId: text("lost_item_id").references(() => items.id, { onDelete: "set null" }),
    claimantId: text("claimant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    finderId: text("finder_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<ClaimStatus>().notNull().default("pending"),
    answers: jsonb("answers").$type<ClaimAnswer[]>().notNull().default([]),
    note: text("note").notNull().default(""),
    decisionNote: text("decision_note").notNull().default(""),
    cardMessageId: text("card_message_id"),
    handover: jsonb("handover").$type<HandoverPlan | null>(),
    ownerReturnedAt: timestamp("owner_returned_at", { withTimezone: true }),
    finderReturnedAt: timestamp("finder_returned_at", { withTimezone: true }),
    thankYou: text("thank_you"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("claims_item_idx").on(t.itemId),
    index("claims_claimant_idx").on(t.claimantId),
    index("claims_finder_idx").on(t.finderId),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    category: text("category"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    placeLabel: text("place_label").notNull().default(""),
    radiusM: integer("radius_m").notNull(),
    active: boolean("active").notNull().default(true),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMS }),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("alerts_user_idx").on(t.userId), index("alerts_active_idx").on(t.active)],
);

export const alertHits = pgTable(
  "alert_hits",
  {
    alertId: text("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.itemId] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default("/"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    reportedUserId: text("reported_user_id").references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reports_unique_idx").on(t.reporterId, t.itemId, t.reportedUserId),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type Desk = typeof desks.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
