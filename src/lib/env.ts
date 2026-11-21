import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  NEXCONN_APP_KEY: z.string().min(1),
  NEXCONN_APP_SECRET: z.string().min(1),
  NEXCONN_API_BASE: z.string().url().default("https://api.sg-light-api.com"),
  NEXCONN_ID_PREFIX: z.string().regex(/^[a-zA-Z0-9]+$/).default("llk"),
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.1-flash-lite"),
  GEMINI_EMBED_MODEL: z.string().default("gemini-embedding-2"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server-side environment. Never import from client components. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3104";
}
