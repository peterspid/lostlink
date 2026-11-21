import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

/** App icons generated from the luggage-tag mark (PNG, any purpose or maskable). */
export async function GET(req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const pad = maskable ? size * 0.2 : size * 0.1;
  const tag = size - pad * 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F0" }}>
        <div
          style={{
            width: tag * 0.72,
            height: tag,
            background: "#F5B800",
            border: `${Math.max(3, tag * 0.05)}px solid #1C2733`,
            borderRadius: tag * 0.1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: tag * 0.12,
          }}
        >
          <div style={{ width: tag * 0.17, height: tag * 0.17, borderRadius: tag, background: "#F3F4F0", border: `${Math.max(2, tag * 0.045)}px solid #1C2733` }} />
          <div style={{ width: tag * 0.36, height: tag * 0.07, background: "#1C2733", borderRadius: tag, marginTop: tag * 0.2 }} />
          <div style={{ width: tag * 0.36, height: tag * 0.07, background: "#1C2733", borderRadius: tag, marginTop: tag * 0.08, marginRight: tag * 0.12 }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
