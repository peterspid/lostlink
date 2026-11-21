"use client";

import { useState } from "react";
import { Crosshair, Search } from "lucide-react";
import { PickerMap } from "@/components/map";
import { Button, Input, cx } from "@/components/ui";
import { getCurrentPosition, reverseGeocode, searchPlaces, type PlaceResult } from "@/lib/client-geo";

export interface LocationValue {
  lat: number;
  lng: number;
  label: string;
}

/** Map pin + "use my location" + place search + editable place name. */
export function LocationField({
  value,
  onChange,
  labelPlaceholder = "e.g. Platform 3, near the ticket counter",
  radiusM,
  mapClassName = "h-60",
  autoLabel = true,
}: {
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
  labelPlaceholder?: string;
  radiusM?: number;
  mapClassName?: string;
  autoLabel?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function setPoint(lat: number, lng: number, label?: string) {
    const current = value?.label ?? "";
    onChange({ lat, lng, label: label ?? current });
    if (autoLabel && label === undefined) {
      const name = await reverseGeocode(lat, lng);
      if (name) onChange({ lat, lng, label: name });
    }
  }

  async function useMyLocation() {
    setError(null);
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      await setPoint(p.lat, p.lng);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function runSearch(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setError(null);
    try {
      const r = await searchPlaces(query.trim());
      setResults(r);
      if (r.length === 0) setError("No places found. Try a nearby landmark or drop a pin.");
    } catch {
      setError("Place search isn't responding. Drop a pin on the map instead.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={useMyLocation} loading={locating} icon={<Crosshair className="size-4" aria-hidden />} className="h-12">
          Use my location
        </Button>
        <div className="relative flex-1">
          <Input
            aria-label="Search for a place"
            placeholder="Or search a place, e.g. Central Station"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch(e);
            }}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-wash"
            aria-label="Search"
            disabled={searching}
          >
            <Search className={cx("size-4", searching && "animate-pulse")} />
          </button>
        </div>
      </div>
      {results && results.length > 0 && (
        <ul className="animate-rise overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[var(--shadow-lift)]">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full border-b border-line px-3.5 py-2.5 text-left text-[15px] last:border-0 hover:bg-wash"
                onClick={() => {
                  setResults(null);
                  void setPoint(r.lat, r.lng, r.label);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm font-semibold text-alert">{error}</p>}
      <div className={cx("overflow-hidden rounded-2xl border border-line-strong", mapClassName)}>
        <PickerMap value={value} onChange={(lat, lng) => void setPoint(lat, lng)} className="h-full w-full" radiusM={radiusM} />
      </div>
      <p className="text-sm text-ink-3">{value ? "Drag the pin or tap the map to adjust." : "Tap the map to drop a pin."}</p>
      {value && (
        <Input
          aria-label="Place name"
          placeholder={labelPlaceholder}
          value={value.label}
          maxLength={120}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
      )}
    </div>
  );
}
