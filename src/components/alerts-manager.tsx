"use client";

import { useState } from "react";
import { BellOff, BellRing, MapPin, Radar, Trash2 } from "lucide-react";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { api, ApiError } from "@/lib/client-api";
import { LocationField, type LocationValue } from "@/components/location-field";
import { Banner, Button, EmptyState, Field, Input, Select } from "@/components/ui";
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
    await api(`/api/alerts/${a.id}`, { method: "PATCH", body: { active: !a.active } }).catch(() => undefined);
    setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
  }

  async function remove(a: AlertRow) {
    await api(`/api/alerts/${a.id}`, { method: "DELETE" }).catch(() => undefined);
    setAlerts((list) => list.filter((x) => x.id !== a.id));
  }

  return (
    <div className="flex flex-col gap-6">
      {alerts.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3.5">
              <span className={a.active ? "mt-0.5 flex size-9 items-center justify-center rounded-md bg-signal" : "mt-0.5 flex size-9 items-center justify-center rounded-md bg-wash"}>
                <Radar className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">&ldquo;{a.query}&rdquo;</p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden /> Within {fmt(a.radiusM)}
                    {a.placeLabel ? ` of ${a.placeLabel}` : ""}
                  </span>
                  {a.category && <span>{categoryLabel(a.category)}</span>}
                </p>
                <p className="text-xs text-ink-3">{a.active ? (a.lastNotifiedAt ? `Last match ${timeAgo(a.lastNotifiedAt)}` : "Watching") : "Paused"}</p>
              </div>
              <button className="flex size-10 items-center justify-center rounded-lg hover:bg-wash" onClick={() => toggle(a)} aria-label={a.active ? "Pause alert" : "Resume alert"}>
                {a.active ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
              </button>
              <button className="flex size-10 items-center justify-center rounded-lg text-alert hover:bg-alert-soft" onClick={() => remove(a)} aria-label="Delete alert">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {alerts.length === 0 && !creating && (
        <EmptyState icon={<Radar className="size-5" />} title="No alerts yet">
          Save a search like &ldquo;black wallet within 3 km&rdquo; and we&apos;ll notify you the moment a matching item is found.
        </EmptyState>
      )}
      {creating ? (
        <form onSubmit={create} className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-surface p-4" noValidate>
          <h2 className="font-display text-xl font-extrabold">New alert</h2>
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
                  className={radiusM === r ? "h-9 rounded-full border border-ink bg-ink px-3 text-sm font-semibold text-paper" : "h-9 rounded-full border border-line-strong bg-surface px-3 text-sm font-semibold"}
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
            <Button type="submit" loading={busy} data-testid="alert-save">
              Save alert
            </Button>
            {alerts.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            )}
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
