"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useRouter } from "next/navigation";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Map pins are luggage-tag teardrops with a punched hole: yellow for found, navy for lost and desks. */
function pinIcon(kind: "lost" | "found" | "pick" | "desk", label?: string) {
  const bg = kind === "found" || kind === "pick" ? "#FFC21A" : kind === "lost" ? "#FFFFFF" : "#10243A";
  const hole = kind === "desk" ? "#FFC21A" : kind === "lost" ? "#10243A" : "#F2F3EE";
  const badge = label
    ? `<span style="position:absolute;left:24px;top:-6px;padding:2px 6px;border-radius:999px;background:#10243A;color:#FFC21A;font:800 11px/1.2 var(--font-overpass),sans-serif;letter-spacing:.04em;white-space:nowrap">${label}</span>`
    : "";
  const html = `
    <div style="position:relative;width:30px;height:38px">
      <div style="position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2.5px solid #10243A;box-shadow:0 6px 14px -4px rgba(16,36,58,.45);display:flex;align-items:center;justify-content:center">
        <div style="width:9px;height:9px;border-radius:999px;background:${hole};border:2px solid #10243A"></div>
      </div>
      ${badge}
    </div>`;
  return L.divIcon({ html, className: "llk-pin", iconSize: [30, 38], iconAnchor: [15, 36] });
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
      {center && radiusM && <Circle center={center} radius={radiusM} pathOptions={{ color: "#10243A", weight: 1.5, fillOpacity: 0.04 }} />}
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
        <Circle center={[markers[0].lat, markers[0].lng]} radius={fuzzRadiusM} pathOptions={{ color: "#10243A", weight: 1, dashArray: "4 4", fillOpacity: 0.06 }} />
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
      {point && radiusM && <Circle center={point} radius={radiusM} pathOptions={{ color: "#10243A", weight: 1.5, fillOpacity: 0.05 }} />}
    </MapContainer>
  );
}
