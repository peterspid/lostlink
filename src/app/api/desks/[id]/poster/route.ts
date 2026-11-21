import { appUrl } from "@/lib/env";
import { handle, notFound } from "@/lib/api";
import { getDesk } from "@/lib/desks";
import { deskPublicUrl, posterPdf, posterPng } from "@/lib/poster";

/** Printable QR poster for a desk: ?format=png (default) or ?format=pdf. */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/desks/[id]/poster">) => {
  const { id } = await ctx.params;
  const desk = await getDesk(id);
  if (!desk) throw notFound("Desk not found.");
  const base = new URL(req.url).origin || appUrl();
  const url = deskPublicUrl(base, desk);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "pdf") {
    const bytes = await posterPdf(desk, url);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="lostlink-${desk.slug}-poster.pdf"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  }
  return posterPng(desk, url);
});
