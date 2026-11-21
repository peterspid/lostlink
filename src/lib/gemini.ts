import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "@/lib/env";
import { CATEGORIES, type Category } from "@/lib/categories";
import { EMBEDDING_DIMS } from "@/lib/db/schema";

export class AiUnavailableError extends Error {
  constructor(message = "AI is busy right now") {
    super(message);
  }
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const key = env().GEMINI_API_KEY;
  if (!key) throw new AiUnavailableError("AI is not configured");
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  const status = (err as { status?: number })?.status;
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    /429|503|500|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|fetch failed|ECONNRESET|ENOTFOUND|timed? ?out|aborted/i.test(msg)
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

/** Retry with exponential backoff; for generation, fall back to the secondary model. */
async function withRetry<T>(models: string[], run: (model: string) => Promise<T>, timeoutMs: number): Promise<T> {
  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await withTimeout(run(model), timeoutMs);
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err)) break;
        await sleep(400 * 2 ** attempt + Math.random() * 200);
      }
    }
  }
  console.error("[gemini] failed:", String((lastErr as Error)?.message ?? lastErr).slice(0, 300));
  throw new AiUnavailableError();
}

// ---------------- Vision pre-fill ----------------

export interface PhotoAnalysis {
  category: Category;
  title: string;
  description: string;
  color: string;
  brand: string;
  material: string;
  marks: string[];
  /** Suggested private verification questions (finder only). */
  questions: { question: string; answer: string }[];
}

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: CATEGORIES.map((c) => c.id) },
    title: { type: Type.STRING, description: "Short title a person would search for, max 60 chars, e.g. 'Black leather wallet'" },
    description: { type: Type.STRING, description: "One or two plain sentences describing the visible item. No guesses about owner." },
    color: { type: Type.STRING, description: "Main color(s), lower case, e.g. 'black' or 'navy and white'. Empty if unclear." },
    brand: { type: Type.STRING, description: "Brand if a logo or text is clearly visible, else empty string." },
    material: { type: Type.STRING, description: "Main material, e.g. leather, steel, fabric. Empty if unclear." },
    marks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Distinguishing marks visible: stickers, scratches, engravings, keychains, case design. Max 5.",
    },
    questions: {
      type: Type.ARRAY,
      description:
        "2 or 3 verification questions only the true owner could answer, based on specific visible details (e.g. 'What sticker is on the back?'), each with the expected answer from the photo.",
      items: {
        type: Type.OBJECT,
        properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
        required: ["question", "answer"],
      },
    },
  },
  required: ["category", "title", "description", "color", "brand", "material", "marks", "questions"],
};

export async function analyzePhoto(image: { data: Buffer; mimeType: string }, kind: "lost" | "found"): Promise<PhotoAnalysis> {
  const { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = env();
  const prompt =
    `You help people report a ${kind} item to a lost-and-found service. Look at the photo and describe the main item ` +
    `factually so it can be matched with other reports. Do not invent details that are not visible. ` +
    `Write in plain English. Respond only with JSON matching the schema.`;
  const result = await withRetry(
    [GEMINI_MODEL, GEMINI_FALLBACK_MODEL],
    async (model) => {
      const res = await ai().models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } }, { text: prompt }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: analysisSchema,
          maxOutputTokens: 800,
          temperature: 0.2,
        },
      });
      const text = res.text;
      if (!text) throw new Error("empty response");
      return JSON.parse(text) as PhotoAnalysis;
    },
    25_000,
  );
  const valid = CATEGORIES.some((c) => c.id === result.category);
  return {
    category: valid ? result.category : "other",
    title: String(result.title ?? "").slice(0, 80),
    description: String(result.description ?? "").slice(0, 500),
    color: String(result.color ?? "").slice(0, 40),
    brand: String(result.brand ?? "").slice(0, 40),
    material: String(result.material ?? "").slice(0, 40),
    marks: (result.marks ?? []).slice(0, 5).map((m) => String(m).slice(0, 80)),
    questions: (result.questions ?? [])
      .slice(0, 3)
      .map((q) => ({ question: String(q.question).slice(0, 160), answer: String(q.answer).slice(0, 120) })),
  };
}

// ---------------- Embeddings ----------------

export async function embed(text: string): Promise<number[]> {
  const { GEMINI_EMBED_MODEL } = env();
  return withRetry(
    [GEMINI_EMBED_MODEL],
    async (model) => {
      const res = await ai().models.embedContent({
        model,
        contents: text.slice(0, 4000),
        config: { outputDimensionality: EMBEDDING_DIMS },
      });
      const values = res.embeddings?.[0]?.values;
      if (!values || values.length !== EMBEDDING_DIMS) throw new Error("bad embedding");
      return values;
    },
    15_000,
  );
}

/** Embedding that never throws: returns null when AI is unavailable. */
export async function tryEmbed(text: string): Promise<number[] | null> {
  try {
    return await embed(text);
  } catch {
    return null;
  }
}
