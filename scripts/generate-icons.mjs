/**
 * Generates every app icon from the LostLink mark (a luggage tag with a punched hole,
 * a string loop and a claim-ticket perforation):
 *   src/app/icon.svg          SVG favicon (modern browsers)
 *   src/app/favicon.ico       16/32/48 px PNG-in-ICO (legacy browsers, crawlers)
 *   src/app/apple-icon.png    180 px home-screen icon (iOS rounds the corners itself)
 *   public/icons/*.png        PWA manifest icons, including a maskable variant
 *
 * Run: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const INK = "#10243A";
const SIGNAL = "#FFC21A";

/** The tag drawn in a 64-unit box. `scale` shrinks it around the centre (maskable safe zone). */
function markSvg({ rounded = true, scale = 1 } = {}) {
  const s = scale;
  const o = (64 - 64 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${INK}"/>
  <g transform="translate(${o} ${o}) scale(${s}) rotate(-14 32 34)">
    <path d="M32 17.5c0-7 4.5-11 10.5-10.5" fill="none" stroke="${SIGNAL}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M25 13h14l9 9v28a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V22z" fill="${SIGNAL}"/>
    <circle cx="32" cy="21" r="3.6" fill="${INK}"/>
    <path d="M21 42.5h22" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3.2 3.6"/>
  </g>
</svg>
`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 1200 }).resize(size, size).png().toBuffer();

/** ICO container holding PNG images (supported by every browser since IE Vista era). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const e = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, e);
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
    dir.writeUInt8(0, e + 2);
    dir.writeUInt8(0, e + 3);
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

const rounded = markSvg();
const square = markSvg({ rounded: false });
const maskable = markSvg({ rounded: false, scale: 0.72 });

await mkdir("public/icons", { recursive: true });
await writeFile("src/app/icon.svg", rounded);
await writeFile("src/app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) })))));
await writeFile("src/app/apple-icon.png", await png(square, 180));
await writeFile("public/icons/icon-192.png", await png(rounded, 192));
await writeFile("public/icons/icon-512.png", await png(rounded, 512));
await writeFile("public/icons/maskable-512.png", await png(maskable, 512));
console.log("Icons written.");
