import { ImageResponse } from "next/og";
import { getItem } from "@/lib/items";
import { categoryLabel } from "@/lib/categories";
import { timeAgo } from "@/lib/time";
import { BrandMark, displayFont, INK, MUTED, PAPER, SIGNAL } from "@/lib/poster";

export const alt = "LostLink item";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  const font = await displayFont();
  const found = item?.kind === "found";
  const visible = item && item.status !== "hidden";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, fontFamily: font ? "Overpass" : undefined }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                padding: "10px 24px 10px 30px",
                fontSize: 36,
                fontWeight: 800,
                borderRadius: 10,
                background: found ? SIGNAL : INK,
                color: found ? INK : PAPER,
              }}
            >
              {visible ? (found ? "Found" : "Lost") : "LostLink"}
            </div>
            {visible && <div style={{ marginLeft: 24, fontSize: 30, color: MUTED, letterSpacing: 4, fontWeight: 800 }}>{`Ref ${item.code}`}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.0, letterSpacing: -2 }}>{visible ? item.title.slice(0, 60) : "Lost & found"}</div>
            {visible && (
              <div style={{ fontSize: 32, marginTop: 24, color: MUTED }}>
                {`${categoryLabel(item.category)}. ${found ? "Found" : "Lost"} ${timeAgo(item.occurredFrom)}${item.placeLabel ? ` near ${item.placeLabel.slice(0, 40)}` : ""}`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BrandMark size={56} />
            <div style={{ fontSize: 36, fontWeight: 800, marginLeft: 12 }}>LostLink</div>
            <div style={{ fontSize: 28, marginLeft: 22, color: MUTED }}>{found ? "Is it yours? Prove it and arrange the handover." : "Seen it? Let the owner know."}</div>
          </div>
        </div>
        {visible && item.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photos[0]} alt="" width={420} height={630} style={{ objectFit: "cover", borderLeft: `10px solid ${found ? SIGNAL : INK}` }} />
        )}
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Overpass", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
