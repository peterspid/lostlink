"use client";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Browser geolocation with a friendly error message. */
export function getCurrentPosition(timeoutMs = 10_000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Your browser can't share your location. Drop a pin on the map instead."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission is off. Drop a pin on the map instead."
              : "Couldn't find your location. Drop a pin on the map instead.",
          ),
        ),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

let lastGeocode = 0;

/** Short human label for a point via OpenStreetMap Nominatim (one request per user action). */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const wait = 1100 - (Date.now() - lastGeocode);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": navigator.language || "en" }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return "";
    const data = (await res.json()) as { name?: string; address?: Record<string, string> };
    const a = data.address ?? {};
    const primary = data.name || a.amenity || a.building || a.road || a.pedestrian || a.neighbourhood || "";
    const area = a.suburb || a.neighbourhood || a.city_district || a.town || a.city || a.village || "";
    return [primary, area !== primary ? area : ""].filter(Boolean).join(", ").slice(0, 120);
  } catch {
    return "";
  }
}

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

export async function searchPlaces(q: string): Promise<PlaceResult[]> {
  const wait = 1100 - (Date.now() - lastGeocode);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, {
    headers: { "Accept-Language": navigator.language || "en" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ label: r.display_name.split(",").slice(0, 3).join(","), lat: Number(r.lat), lng: Number(r.lon) }));
}
