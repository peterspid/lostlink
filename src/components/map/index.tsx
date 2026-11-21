"use client";

import dynamic from "next/dynamic";

function MapLoading() {
  return <div className="h-full w-full animate-pulse rounded-[inherit] bg-wash" aria-label="Loading map" />;
}

/** Leaflet touches `window`, so maps render on the client only. */
export const ItemsMap = dynamic(() => import("./leaflet-maps").then((m) => m.ItemsMap), { ssr: false, loading: MapLoading });
export const PickerMap = dynamic(() => import("./leaflet-maps").then((m) => m.PickerMap), { ssr: false, loading: MapLoading });
export type { MapMarker } from "./leaflet-maps";
