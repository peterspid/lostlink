import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, handle, parseJson, requireUser } from "@/lib/api";
import { analyzePhoto } from "@/lib/gemini";
import { rateLimit } from "@/lib/ratelimit";
import { blobUrl } from "@/lib/validation";

export const maxDuration = 60;

const bodySchema = z.object({ url: blobUrl, kind: z.enum(["lost", "found"]) });

/** Gemini vision: read the photo and pre-fill category, title and attributes. */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  await rateLimit(`ai:${me.id}`, 30, 3600, "You've used photo reading a lot this hour. Fill the details in by hand for now.");
  const { url, kind } = await parseJson(req, bodySchema);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw badRequest("Couldn't read that photo. Upload it again.");
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) throw badRequest("That file isn't an image.");
  const data = Buffer.from(await res.arrayBuffer());
  const analysis = await analyzePhoto({ data, mimeType }, kind);
  return NextResponse.json({ analysis });
});
