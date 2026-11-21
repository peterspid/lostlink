"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useRouter } from "next/navigation";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function pinIcon(kind: "lost" | "found" | "pick" | "desk", label?: string) {
  const bg = kind === "found" || kind === "pick" ? "#F5B800" : kind === "desk" ? "#1C2733" : "#FFFFFF";
  const fg = kind === "desk" ? "#F3F4F0" : "#1C2733";
  const text = label ? `<span style="font:800 11px/1 var(--font-overpass),sans-serif;color:${fg};letter-spacing:.04em">${label}</span>` : "";
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      <div style="min-width:26px;height:26px;padding:0 6px;display:flex;align-items:center;justify-content:center;background:${bg};border:2px solid #1C2733;border-radius:6px;box-shadow:0 2px 6px rgba(28,39,51,.25)">${text}</div>
      <div style="width:2px;height:10px;background:#1C2733"></div>
    </div>`;
  return L.divIcon({ html, className: "llk-pin", iconSize: [40, 40], iconAnchor: [20, 38] });
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "lost" | "found" | "desk";
  label?: string;
  href?: string;
  title?: string;
}

function FitBounds({ markers, center }: { markers: MapMarker[]; center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const pts = markers.map((m) => L.latLng(m.lat, m.lng));
    if (center) pts.push(L.latLng(center[0], center[1]));
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 });
  }, [map, markers, center]);
  return null;
}

export function ItemsMap({
  markers,
  center,
  radiusM,
  className,
  fuzzRadiusM,
}: {
  markers: MapMarker[];
  center?: [number, number];
  radiusM?: number;
  className?: string;
  fuzzRadiusM?: number;
}) {
  const router = useRouter();
  const initial: [number, number] = center ?? (markers[0] ? [markers[0].lat, markers[0].lng] : [20.5937, 78.9629]);
  return (
    <MapContainer center={initial} zoom={markers.length || center ? 14 : 4} scrollWheelZoom={false} className={className} attributionControl>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      {center && radiusM && <Circle center={center} radius={radiusM} pathOptions={{ color: "#1C2733", weight: 1.5, fillOpacity: 0.04 }} />}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.kind, m.label)}
          title={m.title}
          eventHandlers={m.href ? { click: () => router.push(m.href!) } : undefined}
        />
      ))}
      {fuzzRadiusM && markers[0] && (
        <Circle center={[markers[0].lat, markers[0].lng]} radius={fuzzRadiusM} pathOptions={{ color: "#1C2733", weight: 1, dashArray: "4 4", fillOpacity: 0.06 }} />
      )}
      <FitBounds markers={markers} center={center} />
    </MapContainer>
  );
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ point, zoom }: { point: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), zoom));
  }, [map, point, zoom]);
  return null;
}

/** Tap the map or drag the pin to choose a spot. */
export function PickerMap({
  value,
  onChange,
  className,
  radiusM,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  radiusM?: number;
}) {
  const point = useMemo<[number, number] | null>(() => (value ? [value.lat, value.lng] : null), [value]);
  const icon = useMemo(() => pinIcon("pick"), []);
  return (
    <MapContainer center={point ?? [20.5937, 78.9629]} zoom={point ? 16 : 4} scrollWheelZoom className={className}>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <ClickToPick onPick={onChange} />
      <Recenter point={point} zoom={16} />
      {point && (
        <Marker
          position={point}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onChange(ll.lat, ll.lng);
            },
          }}
        />
      )}
      {point && radiusM && <Circle center={point} radius={radiusM} pathOptions={{ color: "#1C2733", weight: 1.5, fillOpacity: 0.05 }} />}
    </MapContainer>
  );
}
