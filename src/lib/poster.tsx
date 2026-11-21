import "server-only";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Desk } from "@/lib/db/schema";

export const INK = "#10243A";
export const PAPER = "#F2F3EE";
export const SIGNAL = "#FFC21A";
export const MUTED = "#4F5D6C";

/** The luggage-tag mark for server-rendered images (posters, Open Graph cards). */
export function BrandMark({ size, line = INK }: { size: number; line?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <g transform="rotate(-14 24 26)">
        <path d="M24 11.5c0-6 3.8-9.5 9-9" fill="none" stroke={line} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M18 8h12l7.5 7.5V40a3.5 3.5 0 0 1-3.5 3.5H14A3.5 3.5 0 0 1 10.5 40V15.5z" fill={SIGNAL} stroke={line} strokeWidth="2.8" strokeLinejoin="round" />
        <circle cx="24" cy="15" r="3" fill={PAPER} stroke={line} strokeWidth="2.6" />
        <path d="M15.5 34h17" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2.6 3" />
      </g>
    </svg>
  );
}

let fontCache: ArrayBuffer | null | undefined;

/** Overpass (the app's display face) for server-rendered images; falls back to the built-in font offline. */
export async function displayFont(): Promise<ArrayBuffer | null> {
  if (fontCache !== undefined) return fontCache;
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Overpass:wght@800", {
      signal: AbortSignal.timeout(4000),
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    fontCache = url ? await fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer()) : null;
  } catch {
    fontCache = null;
  }
  return fontCache ?? null;
}

export function deskPublicUrl(base: string, desk: Pick<Desk, "slug">) {
  return `${base}/desks/${desk.slug}`;
}

export async function posterPng(desk: Desk, url: string): Promise<Response> {
  const qr = await QRCode.toDataURL(url, { margin: 0, width: 640, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });
  const font = await displayFont();
  const shortUrl = url.replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFFFF", color: INK, fontFamily: font ? "Overpass" : undefined }}>
        <div style={{ display: "flex", flexDirection: "column", background: SIGNAL, padding: "90px 96px 80px" }}>
          <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>Lost something here?</div>
          <div style={{ fontSize: 58, fontWeight: 800, marginTop: 36, lineHeight: 1.1 }}>{desk.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, padding: "80px 96px 40px" }}>
          <div style={{ display: "flex", padding: 36, border: `6px solid ${INK}`, borderRadius: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={560} height={560} alt="" />
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, marginTop: 60, textAlign: "center", lineHeight: 1.2 }}>
            Scan to see what has been handed in
          </div>
          <div style={{ fontSize: 34, marginTop: 24, color: MUTED }}>{shortUrl}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", background: INK, color: PAPER, padding: "56px 96px" }}>
          <div style={{ fontSize: 40, fontWeight: 800 }}>Found something? Bring it to the desk.</div>
          <div style={{ fontSize: 32, marginTop: 16 }}>
            {[desk.placeLabel, desk.hours].filter(Boolean).join(". ") || "Staff will log it so the owner can find it."}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
            <div style={{ display: "flex", marginRight: 16 }}>
              <BrandMark size={60} line={PAPER} />
            </div>
            <div style={{ fontSize: 40, fontWeight: 800 }}>LostLink</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1240,
      height: 1754,
      fonts: font ? [{ name: "Overpass", data: font, weight: 800, style: "normal" }] : undefined,
      headers: { "Content-Disposition": `inline; filename="lostlink-${desk.slug}-poster.png"` },
    },
  );
}

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Printable A4 PDF poster with a vector-crisp QR image. */
export async function posterPdf(desk: Desk, url: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${desk.name} lost & found poster`);
  pdf.setCreator("LostLink");
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const qrPng = await QRCode.toBuffer(url, { margin: 0, width: 900, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });
  const qr = await pdf.embedPng(qrPng);
  const m = 46;

  page.drawRectangle({ x: 0, y: height - 200, width, height: 200, color: hex(SIGNAL) });
  page.drawText("Lost something here?", { x: m, y: height - 100, size: 44, font: bold, color: hex(INK) });
  page.drawText(fit(desk.name, bold, 26, width - 2 * m), { x: m, y: height - 150, size: 26, font: bold, color: hex(INK) });

  const qrSize = 290;
  const qrX = (width - qrSize) / 2;
  const qrY = height - 200 - 50 - qrSize;
  page.drawRectangle({ x: qrX - 18, y: qrY - 18, width: qrSize + 36, height: qrSize + 36, borderColor: hex(INK), borderWidth: 3 });
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const line1 = "Scan to see what has been handed in";
  page.drawText(line1, { x: (width - bold.widthOfTextAtSize(line1, 22)) / 2, y: qrY - 60, size: 22, font: bold, color: hex(INK) });
  const shortUrl = url.replace(/^https?:\/\//, "");
  const urlSize = 13;
  page.drawText(shortUrl, { x: (width - regular.widthOfTextAtSize(shortUrl, urlSize)) / 2, y: qrY - 86, size: urlSize, font: regular, color: hex(MUTED) });

  page.drawRectangle({ x: 0, y: 0, width, height: 170, color: hex(INK) });
  page.drawText("Found something? Bring it to the desk.", { x: m, y: 120, size: 18, font: bold, color: hex(PAPER) });
  const info = [desk.placeLabel, desk.hours].filter(Boolean).join(". ") || "Staff will log it so the owner can find it.";
  page.drawText(fit(info, regular, 13, width - 2 * m), { x: m, y: 96, size: 13, font: regular, color: hex(PAPER) });
  page.drawRectangle({ x: m, y: 38, width: 22, height: 22, color: hex(SIGNAL) });
  page.drawText("LostLink", { x: m + 32, y: 42, size: 18, font: bold, color: hex(PAPER) });
  return pdf.save();
}

function fit(text: string, font: { widthOfTextAtSize(t: string, s: number): number }, size: number, max: number) {
  let t = text;
  while (t.length > 3 && font.widthOfTextAtSize(t, size) > max) t = t.slice(0, -2);
  return t === text ? t : `${t.trimEnd()}…`;
}
