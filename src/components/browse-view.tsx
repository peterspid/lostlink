"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Crosshair, List, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/client-api";
import { getCurrentPosition } from "@/lib/client-geo";
import { ItemsMap } from "@/components/map";
import { CategoryIcon, ItemTag, ItemTagSkeleton, type TagItem } from "@/components/item-tag";
import { Banner, Button, EmptyState, Input, LinkButton, Select, cx } from "@/components/ui";

type Result = TagItem & { lat: number; lng: number };

const chip = (on: boolean) =>
  cx(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
    on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink",
  );

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
  const [locating, setLocating] = useState(false);
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
    } catch {
      /* keep the previous results */
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
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      setPoint(p);
      if (!radiusKm) setRadiusKm("5");
    } catch (err) {
      setGeoError((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  function clearAll() {
    setKind("");
    setCategory("");
    setDays("");
    setPoint(null);
    setRadiusKm("");
    setQ("");
  }

  const activeFilters = [kind, category, days, point ? "near" : ""].filter(Boolean).length;
  const markers = items.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, kind: i.kind, href: `/items/${i.id}`, title: i.title }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-signal" aria-hidden>
            <Search className="size-[22px]" />
          </span>
          <div>
            <h1 className="text-[30px] font-black leading-[1.05] md:text-[38px]">Browse lost &amp; found</h1>
            <p className="mt-1 text-ink-2">Public posts with approximate locations. Open one to claim it or get in touch.</p>
          </div>
        </div>
        <div className="flex rounded-xl border border-line-strong bg-surface p-1" role="tablist" aria-label="View">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx("flex h-9 items-center gap-1.5 rounded-lg px-3.5 font-display text-sm font-bold transition-colors", view === v ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
            >
              {v === "list" ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
              {v === "list" ? "List" : "Map"}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-[var(--header-h)] z-[900] -mx-4 mt-6 border-b border-line bg-paper/90 px-4 pb-3 pt-3 backdrop-blur-md">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          role="search"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-ink-3" aria-hidden />
            <Input aria-label="Search items" placeholder="Black wallet, blue backpack, keys…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11 pr-10" enterKeyHint="search" />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-wash hover:text-ink" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button type="submit" className="h-12" loading={loading}>
            Search
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="relative h-12 md:hidden" aria-label="Filters">
            <SlidersHorizontal className="size-4" />
            {activeFilters > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-signal text-[11px] font-black text-ink ring-2 ring-paper">{activeFilters}</span>
            )}
          </Button>
        </form>

        <div className={cx("mt-3 flex-wrap items-center gap-2", showFilters ? "flex" : "hidden md:flex")}>
          <div className="flex rounded-full border border-line-strong bg-surface p-0.5" role="radiogroup" aria-label="Lost or found">
            {[
              ["", "All"],
              ["found", "Found"],
              ["lost", "Lost"],
            ].map(([v, l]) => (
              <button
                key={v}
                role="radio"
                aria-checked={kind === v}
                onClick={() => setKind(v)}
                className={cx(
                  "h-8 rounded-full px-3.5 text-sm font-bold transition-colors",
                  kind === v ? (v === "found" ? "bg-signal text-ink" : "bg-ink text-paper") : "text-ink-2 hover:text-ink",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <Select aria-label="Date" value={days} onChange={(e) => setDays(e.target.value)} compact>
            <option value="">Any time</option>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </Select>
          <Button type="button" variant={point ? "ink" : "outline"} size="sm" className="rounded-full" onClick={nearMe} loading={locating} icon={<Crosshair className="size-4" aria-hidden />}>
            {point ? "Near me" : "Use my location"}
          </Button>
          {point && (
            <Select aria-label="Distance" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} compact>
              <option value="">Any distance</option>
              <option value="1">Within 1 km</option>
              <option value="3">Within 3 km</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
            </Select>
          )}
          {(activeFilters > 0 || q) && (
            <button type="button" onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink-2 hover:bg-wash hover:text-ink">
              <X className="size-4" aria-hidden /> Clear all
            </button>
          )}
        </div>

        <div className={cx("-mx-4 mt-3 gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]", showFilters ? "flex" : "hidden md:flex")} role="radiogroup" aria-label="Category">
          <button role="radio" aria-checked={category === ""} onClick={() => setCategory("")} className={chip(category === "")}>
            Any category
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} role="radio" aria-checked={category === c.id} onClick={() => setCategory(category === c.id ? "" : c.id)} className={chip(category === c.id)}>
              <CategoryIcon category={c.id} className={cx("size-4", category === c.id && "text-signal")} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {geoError && (
        <div className="mt-4">
          <Banner tone="info" onClose={() => setGeoError(null)}>
            {geoError}
          </Banner>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-ink-3" aria-live="polite">
          {loading ? "Searching…" : `${items.length} item${items.length === 1 ? "" : "s"}${point && !q ? ", nearest first" : ""}`}
        </p>
        {view === "map" ? (
          <div className="h-[64dvh] overflow-hidden rounded-3xl border border-line-strong shadow-[var(--shadow-lift)]">
            <ItemsMap markers={markers} center={point ? [point.lat, point.lng] : undefined} radiusM={point && radiusKm ? Number(radiusKm) * 1000 : undefined} className="h-full w-full" />
          </div>
        ) : loading && items.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <ItemTagSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="Nothing matches yet"
            action={
              <div className="flex flex-wrap gap-2">
                <LinkButton href="/alerts" variant="ink" icon={<BellRing className="size-4" aria-hidden />}>
                  Create an alert
                </LinkButton>
                {(activeFilters > 0 || q) && (
                  <Button variant="outline" onClick={clearAll}>
                    Clear filters
                  </Button>
                )}
              </div>
            }
          >
            Try a wider area or fewer filters. Or save an alert and we&apos;ll tell you the moment something like it is found.
          </EmptyState>
        ) : (
          <div className={cx("grid gap-3 transition-opacity md:grid-cols-2", loading && "opacity-60")}>
            {items.map((i) => (
              <ItemTag key={i.id} item={i} />
            ))}
          </div>
        )}
        {view === "map" && <p className="mt-2 text-sm text-ink-3">Pins show approximate locations. Tap one to open it.</p>}
      </div>
    </div>
  );
}
