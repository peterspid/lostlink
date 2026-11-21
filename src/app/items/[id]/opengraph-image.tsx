import { ImageResponse } from "next/og";
import { getItem } from "@/lib/items";
import { categoryLabel } from "@/lib/categories";
import { timeAgo } from "@/lib/time";
import { displayFont, INK, PAPER, SIGNAL } from "@/lib/poster";

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
                padding: "10px 22px",
                fontSize: 36,
                fontWeight: 800,
                borderRadius: 10,
                background: found ? SIGNAL : "transparent",
                border: `4px solid ${found ? SIGNAL : INK}`,
              }}
            >
              {visible ? (found ? "Found" : "Lost") : "LostLink"}
            </div>
            {visible && <div style={{ marginLeft: 24, fontSize: 30, color: "#4A5562", letterSpacing: 3 }}>{`Ref ${item.code}`}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1.5 }}>{visible ? item.title.slice(0, 60) : "Lost & found"}</div>
            {visible && (
              <div style={{ fontSize: 32, marginTop: 24, color: "#4A5562" }}>
                {`${categoryLabel(item.category)}. ${found ? "Found" : "Lost"} ${timeAgo(item.occurredFrom)}${item.placeLabel ? ` near ${item.placeLabel.slice(0, 40)}` : ""}`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: SIGNAL, border: `3px solid ${INK}`, marginRight: 16 }} />
            <div style={{ fontSize: 34, fontWeight: 800 }}>LostLink</div>
            <div style={{ fontSize: 28, marginLeft: 20, color: "#4A5562" }}>{found ? "Is it yours? Prove it and arrange the handover." : "Seen it? Let the owner know."}</div>
          </div>
        </div>
        {visible && item.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photos[0]} alt="" width={420} height={630} style={{ objectFit: "cover", borderLeft: `6px solid ${INK}` }} />
        )}
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Overpass", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
