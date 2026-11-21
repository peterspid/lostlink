"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Download, RefreshCw, UserMinus } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { LocationField, type LocationValue } from "@/components/location-field";
import { Avatar, Banner, Button, Field, Input, Select, Textarea, buttonClass } from "@/components/ui";

const KINDS = [
  ["campus", "Campus"],
  ["mall", "Mall"],
  ["station", "Station or airport"],
  ["event", "Event or venue"],
  ["office", "Office or building"],
  ["other", "Something else"],
] as const;

export function CreateDeskForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("campus");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [loc, setLoc] = useState<LocationValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return setError("Name your desk, e.g. North Campus Library Desk.");
    if (!loc || loc.label.trim().length < 2) return setError("Pin the desk on the map and name the spot.");
    setBusy(true);
    setError(null);
    try {
      const { slug } = await api<{ slug: string }>("/api/desks", {
        body: { name: name.trim(), kind, description: description.trim(), hours: hours.trim(), placeLabel: loc.label.trim(), lat: loc.lat, lng: loc.lng },
      });
      router.push(`/desks/${slug}/manage?created=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the desk.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && <Banner tone="error">{error}</Banner>}
      <Field label="Desk name" htmlFor="desk-name" hint="What people will see on the poster.">
        <Input id="desk-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Central Station Lost Property" data-testid="desk-name" />
      </Field>
      <Field label="Type of place" htmlFor="desk-kind">
        <Select id="desk-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Where is the desk?">
        <LocationField value={loc} onChange={setLoc} labelPlaceholder="e.g. Ground floor, next to Gate 2" />
      </Field>
      <Field label="Opening hours" htmlFor="desk-hours" optional>
        <Input id="desk-hours" value={hours} maxLength={120} onChange={(e) => setHours(e.target.value)} placeholder="Mon to Sat, 9:00 to 18:00" />
      </Field>
      <Field label="Notes for visitors" htmlFor="desk-desc" optional>
        <Textarea id="desk-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Bring an ID to collect items. Unclaimed items are kept for 60 days." />
      </Field>
      <Button type="submit" size="lg" loading={busy} data-testid="desk-create">
        Create desk
      </Button>
    </form>
  );
}

export function InvitePanel({ deskId, initialToken, isOwner }: { deskId: string; initialToken: string; isOwner: boolean }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/desks/join/${token}` : `/desks/join/${token}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input readOnly value={link} aria-label="Staff invite link" onFocus={(e) => e.currentTarget.select()} data-testid="invite-link" />
        <Button
          variant="outline"
          aria-label="Copy invite link"
          onClick={async () => {
            await navigator.clipboard?.writeText(link).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <p className="text-sm text-ink-3">Anyone with this link can join as staff. They&apos;ll join the staff chat and can log items.</p>
      {isOwner && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          loading={busy}
          icon={<RefreshCw className="size-4" aria-hidden />}
          onClick={async () => {
            setBusy(true);
            const r = await api<{ token: string }>(`/api/desks/${deskId}/members`, { method: "POST" }).catch(() => null);
            if (r) setToken(r.token);
            setBusy(false);
          }}
        >
          Reset link
        </Button>
      )}
    </div>
  );
}

export function PosterButtons({ deskId }: { deskId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/desks/${deskId}/poster?format=pdf`} target="_blank" rel="noreferrer" className={buttonClass("signal", "md")} data-testid="poster-pdf">
        <Download className="size-4" aria-hidden /> Poster (PDF, A4)
      </a>
      <a href={`/api/desks/${deskId}/poster?format=png`} target="_blank" rel="noreferrer" className={buttonClass("outline", "md")} data-testid="poster-png">
        <Download className="size-4" aria-hidden /> Poster (PNG)
      </a>
    </div>
  );
}

export function StaffList({ deskId, members, ownerId, isOwner }: { deskId: string; members: { userId: string; name: string; role: string }[]; ownerId: string; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <ul className="flex flex-col gap-2" data-testid="staff-list">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-3 rounded-2xl border border-line bg-paper/60 p-2.5">
          <Avatar name={m.name} size="sm" tone={m.userId === ownerId ? "signal" : "ink"} />
          <span className="flex-1 font-semibold">{m.name}</span>
          <span className="text-sm text-ink-2">{m.userId === ownerId ? "Owner" : "Staff"}</span>
          {isOwner && m.userId !== ownerId && (
            <Button
              size="sm"
              variant="danger"
              loading={busy === m.userId}
              icon={<UserMinus className="size-4" aria-hidden />}
              onClick={async () => {
                setBusy(m.userId);
                await api(`/api/desks/${deskId}/members`, { method: "DELETE", body: { userId: m.userId } }).catch(() => undefined);
                router.refresh();
                setBusy(null);
              }}
            >
              Remove
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function JoinDeskButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {error && <Banner tone="error">{error}</Banner>}
      <Button
        size="lg"
        loading={busy}
        data-testid="join-desk"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { slug } = await api<{ slug: string }>("/api/desks/join", { body: { token } });
            router.push(`/desks/${slug}/manage`);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't join the desk.");
            setBusy(false);
          }
        }}
      >
        Join as staff
      </Button>
    </div>
  );
}
