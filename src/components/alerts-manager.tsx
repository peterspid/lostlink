"use client";

import { useState } from "react";
import { BellOff, BellRing, MapPin, Radar, Trash2 } from "lucide-react";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { api, ApiError } from "@/lib/client-api";
import { LocationField, type LocationValue } from "@/components/location-field";
import { Banner, Button, EmptyState, Field, Input, Select, cx } from "@/components/ui";
import { timeAgo } from "@/lib/time";

export interface AlertRow {
  id: string;
  query: string;
  category: string | null;
  placeLabel: string;
  radiusM: number;
  active: boolean;
  lastNotifiedAt: string | null;
}

const RADII = [500, 1000, 3000, 5000, 10000, 25000];
const fmt = (m: number) => (m < 1000 ? `${m} m` : `${m / 1000} km`);

export function AlertsManager({ initial }: { initial: AlertRow[] }) {
  const [alerts, setAlerts] = useState(initial);
  const [creating, setCreating] = useState(initial.length === 0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loc, setLoc] = useState<LocationValue | null>(null);
  const [radiusM, setRadiusM] = useState(3000);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data = await api<{ alerts: (AlertRow & { lastNotifiedAt: string | null })[] }>("/api/alerts");
    setAlerts(data.alerts);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return setError("Describe what to watch for, e.g. black wallet.");
    if (!loc) return setError("Drop a pin for the area to watch.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/alerts", { body: { query: query.trim(), category: category || null, lat: loc.lat, lng: loc.lng, placeLabel: loc.label, radiusM } });
      setQuery("");
      setCategory("");
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the alert.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: AlertRow) {
    try {
      await api(`/api/alerts/${a.id}`, { method: "PATCH", body: { active: !a.active } });
      setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the alert.");
    }
  }

  async function remove(a: AlertRow) {
    try {
      await api(`/api/alerts/${a.id}`, { method: "DELETE" });
      setAlerts((list) => list.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the alert.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && !creating && (
        <Banner tone="error" onClose={() => setError(null)}>
          {error}
        </Banner>
      )}
      {alerts.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={cx("animate-rise flex items-start gap-3 rounded-2xl border bg-surface p-4 transition-opacity", a.active ? "border-line" : "border-dashed border-line-strong opacity-75")}>
              <span className={cx("relative mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl", a.active ? "bg-ink text-signal" : "bg-wash text-ink-3")}>
                {a.active && <span className="absolute inset-0 animate-ping rounded-xl bg-signal/25 [animation-duration:2.4s]" aria-hidden />}
                <Radar className="relative size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[17px] font-bold">&ldquo;{a.query}&rdquo;</p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden /> Within {fmt(a.radiusM)}
                    {a.placeLabel ? ` of ${a.placeLabel}` : ""}
                  </span>
                  {a.category && <span>{categoryLabel(a.category)}</span>}
                </p>
                <p className={cx("mt-1 text-xs font-semibold", a.active ? "text-go" : "text-ink-3")}>{a.active ? (a.lastNotifiedAt ? `Watching. Last match ${timeAgo(a.lastNotifiedAt)}` : "Watching") : "Paused"}</p>
              </div>
              <button className="flex size-10 items-center justify-center rounded-xl hover:bg-wash" onClick={() => toggle(a)} aria-label={a.active ? "Pause alert" : "Resume alert"}>
                {a.active ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
              </button>
              <button className="flex size-10 items-center justify-center rounded-xl text-alert hover:bg-alert-soft" onClick={() => remove(a)} aria-label="Delete alert">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {alerts.length === 0 && !creating && (
        <EmptyState icon={<Radar />} title="No alerts yet">
          Save a search like &ldquo;black wallet within 3 km&rdquo; and we&apos;ll notify you the moment a matching item is found.
        </EmptyState>
      )}
      {creating ? (
        <form onSubmit={create} className="animate-rise flex flex-col gap-5 overflow-hidden rounded-3xl border border-ink bg-surface pb-5" noValidate>
          <div className="on-ink flex items-center gap-2.5 bg-ink px-5 py-3.5 text-paper">
            <span className="flex size-8 items-center justify-center rounded-lg bg-signal text-ink">
              <BellRing className="size-4" aria-hidden />
            </span>
            <h2 className="font-display text-lg font-extrabold">New alert</h2>
          </div>
          <div className="flex flex-col gap-5 px-5">
          {error && <Banner tone="error">{error}</Banner>}
          <Field label="What are you looking for?" htmlFor="alert-q" hint="A few words, like you'd describe it to a friend.">
            <Input id="alert-q" placeholder="black leather wallet" value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} data-testid="alert-query" />
          </Field>
          <Field label="Category" htmlFor="alert-cat" optional>
            <Select id="alert-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Area: within ${fmt(radiusM)}`}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Radius">
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={radiusM === r}
                  onClick={() => setRadiusM(r)}
                  className={cx("h-9 rounded-full border px-3.5 text-sm font-bold transition-colors", radiusM === r ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:border-ink")}
                >
                  {fmt(r)}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <LocationField value={loc} onChange={setLoc} radiusM={radiusM} mapClassName="h-56" labelPlaceholder="Area name, e.g. Around the university" />
            </div>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="lg" variant="signal" loading={busy} data-testid="alert-save">
              Save alert
            </Button>
            {alerts.length > 0 && (
              <Button type="button" size="lg" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            )}
          </div>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)} icon={<BellRing className="size-4" aria-hidden />} className="self-start">
          New alert
        </Button>
      )}
    </div>
  );
}
