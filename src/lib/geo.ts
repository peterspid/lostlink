const R = 6_371_000; // earth radius, metres

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box around a point, for an index-friendly prefilter before exact distance. */
export function boundingBox(lat: number, lng: number, radiusM: number) {
  const dLat = (radiusM / R) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/**
 * Public location for an item: snapped to a ~300 m grid cell centre plus a deterministic
 * offset from the item id, so the exact spot is never published and repeated reads agree.
 */
export function fuzzLocation(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  const cell = 0.0027; // ~300 m
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const jitterLat = ((h % 1000) / 1000 - 0.5) * cell * 0.6;
  const jitterLng = (((h >>> 10) % 1000) / 1000 - 0.5) * cell * 0.6;
  const snappedLat = Math.floor(lat / cell) * cell + cell / 2;
  const snappedLng = Math.floor(lng / cell) * cell + cell / 2;
  return { lat: round(snappedLat + jitterLat, 5), lng: round(snappedLng + jitterLng, 5) };
}

function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function formatDistance(m: number): string {
  if (m < 50) return "right here";
  if (m < 1000) return `${Math.round(m / 50) * 50} m away`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km away`;
  return `${Math.round(m / 1000)} km away`;
}

export function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
