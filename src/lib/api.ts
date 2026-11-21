import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { currentUser, type SessionUser } from "@/lib/auth/session";
import { AiUnavailableError } from "@/lib/gemini";
import { RateLimitError } from "@/lib/ratelimit";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const forbidden = (m = "You don't have access to this.") => new HttpError(403, m);
export const notFound = (m = "Not found.") => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Sign in to continue.");
  return u;
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be JSON.");
  }
  return schema.parse(body);
}

/** Wrap a route handler with uniform error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof RateLimitError)
        return NextResponse.json(
          { error: err.message },
          { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } },
        );
      if (err instanceof AiUnavailableError)
        return NextResponse.json({ error: err.message, aiBusy: true }, { status: 503 });
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const field = first?.path.join(".");
        return NextResponse.json(
          { error: first ? `${field ? field + ": " : ""}${first.message}` : "Invalid input." },
          { status: 400 },
        );
      }
      console.error("[api] unexpected error", err);
      return NextResponse.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}
