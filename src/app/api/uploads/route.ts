import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { badRequest, handle, requireUser } from "@/lib/api";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { rateLimit } from "@/lib/ratelimit";

const MAX_BYTES = 3 * 1024 * 1024; // images are resized on the phone first (~200-500 KB)
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  await rateLimit(`upload:${me.id}`, 40, 3600, "Upload limit reached. Try again later.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Attach a photo.");
  const ext = TYPES[file.type];
  if (!ext) throw badRequest("Photos must be JPEG, PNG or WebP.");
  if (file.size > MAX_BYTES) throw badRequest("That photo is too large. Try a smaller one.");
  const blob = await put(`items/${me.id}/${newId()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
    token: env().BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url }, { status: 201 });
});
