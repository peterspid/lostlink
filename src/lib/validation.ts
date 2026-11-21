import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";

const trimmed = (max: number) => z.string().trim().max(max);

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name (at least 2 characters)").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const blobUrl = z
  .string()
  .url()
  .refine((u) => /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(u), "Photo must be uploaded through LostLink");

export const itemCreateSchema = z
  .object({
    kind: z.enum(["lost", "found"]),
    category: z.enum(CATEGORY_IDS),
    title: z.string().trim().min(3, "Give it a short title").max(80),
    description: trimmed(1000).default(""),
    color: trimmed(40).default(""),
    brand: trimmed(40).default(""),
    material: trimmed(40).default(""),
    marks: z.array(trimmed(80)).max(8).default([]),
    photos: z.array(blobUrl).max(4).default([]),
    lat,
    lng,
    placeLabel: trimmed(120).default(""),
    occurredFrom: z.coerce.date(),
    occurredTo: z.coerce.date(),
    questions: z
      .array(z.object({ question: z.string().trim().min(3).max(160), answer: z.string().trim().min(1).max(120) }))
      .max(5)
      .default([]),
    aiFilled: z.boolean().default(false),
    deskId: z.string().max(40).optional(),
  })
  .refine((v) => v.occurredTo.getTime() >= v.occurredFrom.getTime(), { message: "End time must be after start time", path: ["occurredTo"] })
  .refine((v) => v.occurredFrom.getTime() <= Date.now() + 10 * 60 * 1000, { message: "That time is in the future", path: ["occurredFrom"] })
  .refine((v) => v.kind === "lost" || v.questions.length >= 1, {
    message: "Add at least one question only the owner can answer",
    path: ["questions"],
  });

export type ItemCreateInput = z.infer<typeof itemCreateSchema>;

export const itemPatchSchema = z.object({
  action: z.enum(["renew", "close", "reopen"]),
});

export const claimCreateSchema = z.object({
  itemId: z.string().min(1).max(40),
  lostItemId: z.string().max(40).optional().nullable(),
  answers: z.array(z.object({ questionId: z.string().max(40), answer: z.string().trim().min(1, "Answer every question").max(200) })).max(5),
  note: trimmed(500).default(""),
});

export const decisionSchema = z.object({
  approve: z.boolean(),
  note: trimmed(300).default(""),
});

export const handoverSchema = z.object({
  lat,
  lng,
  label: z.string().trim().min(2, "Name the meeting point").max(120),
  at: z.coerce.date().refine((d) => d.getTime() > Date.now() - 60 * 60 * 1000, "Pick a time from now on"),
});

export const handoverActionSchema = z.object({ action: z.enum(["accept", "decline"]) });

export const thanksSchema = z.object({ text: z.string().trim().min(2).max(500) });

export const alertCreateSchema = z.object({
  query: z.string().trim().min(2, "Describe what to watch for").max(120),
  category: z.enum(CATEGORY_IDS).optional().nullable(),
  lat,
  lng,
  placeLabel: trimmed(120).default(""),
  radiusM: z.number().int().min(200).max(25_000),
});

export const blockSchema = z.object({ userId: z.string().min(1).max(40) });

export const reportSchema = z
  .object({
    itemId: z.string().max(40).optional(),
    userId: z.string().max(40).optional(),
    reason: z.enum(["scam", "fake", "offensive", "personal-info", "other"]),
    details: trimmed(500).default(""),
  })
  .refine((v) => v.itemId || v.userId, "Report an item or a person");

export const deskCreateSchema = z.object({
  name: z.string().trim().min(3, "Name your desk").max(80),
  kind: z.enum(["campus", "mall", "station", "event", "office", "other"]),
  description: trimmed(500).default(""),
  hours: trimmed(120).default(""),
  placeLabel: z.string().trim().min(2, "Where is the desk?").max(120),
  lat,
  lng,
});

export const joinDeskSchema = z.object({ token: z.string().min(10).max(64) });
