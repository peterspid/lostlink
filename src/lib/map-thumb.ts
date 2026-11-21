"use client";

import { canvasToBase64 } from "@/lib/image-resize";

const W = 200;
const H = 120;
const ZOOM = 16;

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    setTimeout(() => reject(new Error("tile timeout")), 5000);
  });
}

/**
 * Small JPEG map thumbnail (base64, no prefix) for a Nexconn location message.
 * Draws the OpenStreetMap tiles around the point plus a pin; falls back to a plain
 * drawn pin if tiles can't load. Kept small to fit the 15 KB message limit.
 */
export async function locationThumbnail(lat: number, lng: number): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#E7E9E3";
  ctx.fillRect(0, 0, W, H);
  try {
    const n = 2 ** ZOOM;
    const px = ((lng + 180) / 360) * n * 256;
    const latRad = (lat * Math.PI) / 180;
    const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
    const left = px - W / 2;
    const top = py - H / 2;
    const tiles: Promise<void>[] = [];
    for (let tx = Math.floor(left / 256); tx <= Math.floor((left + W) / 256); tx++) {
      for (let ty = Math.floor(top / 256); ty <= Math.floor((top + H) / 256); ty++) {
        tiles.push(
          loadTile(ZOOM, ((tx % n) + n) % n, ty).then((img) => {
            ctx.drawImage(img, tx * 256 - left, ty * 256 - top);
          }),
        );
      }
    }
    await Promise.all(tiles);
  } catch {
    ctx.strokeStyle = "#C9CDC4";
    for (let i = 0; i < W; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, H);
      ctx.stroke();
    }
  }
  // Pin: signal-yellow tag on an ink stem.
  const cx = W / 2;
  const cy = H / 2;
  ctx.fillStyle = "#10243A";
  ctx.fillRect(cx - 1, cy - 4, 2, 10);
  ctx.fillStyle = "#FFC21A";
  ctx.strokeStyle = "#10243A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - 9, cy - 22, 18, 18, 4);
  ctx.fill();
  ctx.stroke();
  try {
    return canvasToBase64(canvas, 0.55);
  } catch {
    // Tainted canvas (tiles without CORS): redraw without tiles.
    const c2 = document.createElement("canvas");
    c2.width = W;
    c2.height = H;
    const x = c2.getContext("2d")!;
    x.fillStyle = "#E7E9E3";
    x.fillRect(0, 0, W, H);
    x.drawImage(canvas, 0, 0, 0, 0);
    x.fillStyle = "#FFC21A";
    x.fillRect(cx - 9, cy - 22, 18, 18);
    return canvasToBase64(c2, 0.55);
  }
}
