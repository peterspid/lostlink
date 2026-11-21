"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, List, Map as MapIcon, Search, SlidersHorizontal } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/client-api";
import { getCurrentPosition } from "@/lib/client-geo";
import { ItemsMap } from "@/components/map";
import { ItemTag, type TagItem } from "@/components/item-tag";
import { Banner, Button, EmptyState, Input, LinkButton, Select, Spinner, cx } from "@/components/ui";

type Result = TagItem & { lat: number; lng: number };

export function BrowseView({ initial }: { initial: Result[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [kind, setKind] = useState(sp.get("kind") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [days, setDays] = useState(sp.get("days") ?? "");
  const [radiusKm, setRadiusKm] = useState(sp.get("radiusKm") ?? "");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    sp.get("lat") && sp.get("lng") ? { lat: Number(sp.get("lat")), lng: Number(sp.get("lng")) } : null,
  );
  const [view, setView] = useState<"list" | "map">(sp.get("view") === "map" ? "map" : "list");
  const [items, setItems] = useState<Result[]>(initial);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const first = useRef(true);

  const run = useCallback(async () => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (category) params.set("category", category);
    if (q.trim()) params.set("q", q.trim());
    if (days) params.set("days", days);
    if (point) {
      params.set("lat", point.lat.toFixed(5));
      params.set("lng", point.lng.toFixed(5));
      if (radiusKm) params.set("radiusKm", radiusKm);
    }
    if (view === "map") params.set("view", "map");
    router.replace(`/browse${params.toString() ? `?${params}` : ""}`, { scroll: false });
    setLoading(true);
    try {
      const data = await api<{ items: Result[] }>(`/api/items?${params}&limit=80`);
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [kind, category, q, days, point, radiusKm, view, router]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void run();
    // Search text runs on submit only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, category, days, point, radiusKm, view]);

  async function nearMe() {
    setGeoError(null);
    try {
      const p = await getCurrentPosition();
      setPoint(p);
      if (!radiusKm) setRadiusKm("5");
    } catch (err) {
      setGeoError((err as Error).message);
    }
  }

  const markers = items.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, kind: i.kind, href: `/items/${i.id}`, title: i.title }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Browse</h1>
        <div className="flex rounded-lg border border-line-strong bg-surface p-0.5" role="tablist" aria-label="View">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx("flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold", view === v ? "bg-ink text-paper" : "text-ink-2")}
            >
              {v === "list" ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
              {v === "list" ? "List" : "Map"}
            </button>
          ))}
        </div>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        role="search"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-ink-3" aria-hidden />
          <Input aria-label="Search items" placeholder="Search: black wallet, blue backpack, keys…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
        </div>
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="md:hidden" aria-label="Filters">
          <SlidersHorizontal className="size-4" />
        </Button>
      </form>

      <div className={cx("mt-3 flex-wrap items-center gap-2", showFilters ? "flex" : "hidden md:flex")}>
        <div className="flex rounded-full border border-line-strong bg-surface p-0.5" role="radiogroup" aria-label="Lost or found">
          {[
            ["", "All"],
            ["found", "Found"],
            ["lost", "Lost"],
          ].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={kind === v} onClick={() => setKind(v)} className={cx("h-9 rounded-full px-3.5 text-sm font-semibold", kind === v ? "bg-ink text-paper" : "text-ink-2")}>
              {l}
            </button>
          ))}
        </div>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-auto min-w-40 text-sm">
          <option value="">Any category</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Date" value={days} onChange={(e) => setDays(e.target.value)} className="h-10 w-auto text-sm">
          <option value="">Any time</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </Select>
        <Button type="button" variant={point ? "ink" : "outline"} size="sm" className="h-10" onClick={nearMe} icon={<Crosshair className="size-4" aria-hidden />}>
          {point ? "Near me" : "Use my location"}
        </Button>
        {point && (
          <Select aria-label="Distance" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} className="h-10 w-auto text-sm">
            <option value="">Any distance</option>
            <option value="1">Within 1 km</option>
            <option value="3">Within 3 km</option>
            <option value="5">Within 5 km</option>
            <option value="10">Within 10 km</option>
            <option value="25">Within 25 km</option>
          </Select>
        )}
      </div>
      {geoError && (
        <div className="mt-3">
          <Banner tone="info" onClose={() => setGeoError(null)}>
            {geoError}
          </Banner>
        </div>
      )}

      <div className="mt-5">
        {loading && (
          <div className="mb-3">
            <Spinner label="Searching" />
          </div>
        )}
        {view === "map" ? (
          <div className="h-[62dvh] overflow-hidden rounded-xl border border-line-strong">
            <ItemsMap markers={markers} center={point ? [point.lat, point.lng] : undefined} radiusM={point && radiusKm ? Number(radiusKm) * 1000 : undefined} className="h-full w-full" />
          </div>
        ) : items.length === 0 && !loading ? (
          <EmptyState title="Nothing matches yet" action={<LinkButton href="/alerts" variant="outline">Create an alert</LinkButton>}>
            Try a wider area or fewer filters. Or save an alert and we&apos;ll tell you when something like it is found.
          </EmptyState>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {items.map((i) => (
              <ItemTag key={i.id} item={i} />
            ))}
          </div>
        )}
        {view === "map" && <p className="mt-2 text-sm text-ink-3">{items.length} item{items.length === 1 ? "" : "s"}. Pins show approximate locations.</p>}
      </div>
    </div>
  );
}
