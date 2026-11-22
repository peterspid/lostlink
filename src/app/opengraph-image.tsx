import { ImageResponse } from "next/og";
import { BrandMark, displayFont, INK, PAPER, SIGNAL } from "@/lib/poster";

export const alt = "LostLink: lost it? Found it? Start here.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  ["K7Q3F", "Leather wallet", "Found"],
  ["M4TZ8", "Backpack", "Found"],
  ["R2WP6", "House keys", "Lost"],
];

/** Site-wide share card: the headline beside a lost property board. */
export default async function OgImage() {
  const font = await displayFont();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, fontFamily: font ? "Overpass" : undefined, padding: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BrandMark size={64} />
            <div style={{ fontSize: 40, fontWeight: 800, marginLeft: 12, letterSpacing: -1 }}>LostLink</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3 }}>
            <div>Lost it?</div>
            <div>Found it?</div>
            <div>Start here.</div>
          </div>
          <div style={{ fontSize: 28, color: "#4F5D6C" }}>Match, prove ownership and hand it back in a private chat.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 470, background: "#0B1A2B", borderRadius: 32, padding: 28, color: PAPER, alignSelf: "center" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, marginBottom: 18 }}>Lost property board</div>
          {ROWS.map(([code, title, kind]) => (
            <div key={code} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", borderRadius: 18, padding: "14px 16px", marginTop: 10 }}>
              <div style={{ display: "flex" }}>
                {code.split("").map((ch, i) => (
                  <div key={i} style={{ display: "flex", width: 26, height: 36, marginRight: 3, alignItems: "center", justifyContent: "center", background: "#1E3653", borderRadius: 5, color: SIGNAL, fontSize: 22, fontWeight: 800 }}>
                    {ch}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flex: 1, marginLeft: 14, fontSize: 22, fontWeight: 800 }}>{title}</div>
              <div style={{ display: "flex", padding: "4px 10px", borderRadius: 6, fontSize: 16, fontWeight: 800, background: kind === "Found" ? SIGNAL : PAPER, color: INK }}>{kind}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Overpass", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
