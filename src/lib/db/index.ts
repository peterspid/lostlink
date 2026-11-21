import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = ReturnType<typeof drizzle<typeof schema>>;
let instance: DB | null = null;

const CONNECT_PHASE = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT", "ECONNRESET"]);

function errorCode(err: unknown): string | undefined {
  let e = err as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; i < 4 && e; i++) {
    if (e.code) return e.code;
    e = e.cause as typeof e;
  }
  return undefined;
}

/**
 * Retry Neon HTTP queries when the request never got a response (DNS / connect / reset).
 * HTTP errors from Postgres are returned as-is and never retried.
 */
const retryingFetch: typeof fetch = async (input, init) => {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      last = err;
      const code = errorCode(err);
      if (code && !CONNECT_PHASE.has(code)) throw err;
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    }
  }
  throw last;
};

export function db(): DB {
  if (!instance) {
    neonConfig.fetchFunction = retryingFetch;
    instance = drizzle(neon(env().DATABASE_URL), { schema });
  }
  return instance;
}

export { schema };
