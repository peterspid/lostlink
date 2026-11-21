"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, EyeOff, ImagePlus, Lock, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { api, ApiError } from "@/lib/client-api";
import { resizeImage } from "@/lib/image-resize";
import { LocationField, type LocationValue } from "@/components/location-field";
import { Banner, Button, Field, Input, Textarea, cx } from "@/components/ui";

type Kind = "lost" | "found";

interface Analysis {
  category: string;
  title: string;
  description: string;
  color: string;
  brand: string;
  material: string;
  marks: string[];
  questions: { question: string; answer: string }[];
}

interface Photo {
  key: string;
  preview: string;
  url?: string;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STEPS = ["Photos", "Details", "Where and when"] as const;

export function ReportForm({
  initialKind,
  desk,
  prefill,
}: {
  initialKind: Kind | null;
  desk: { id: string; name: string; lat: number; lng: number; placeLabel: string } | null;
  prefill: { title: string; category: string };
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | null>(initialKind);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [aiState, setAiState] = useState<"idle" | "reading" | "done" | "busy">("idle");
  const [aiFilled, setAiFilled] = useState(false);
  const touched = useRef(new Set<string>());
  const aiStarted = useRef(false);

  const [category, setCategory] = useState(CATEGORIES.some((c) => c.id === prefill.category) ? prefill.category : "");
  const [title, setTitle] = useState(prefill.title);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [marks, setMarks] = useState<string[]>([]);
  const [markDraft, setMarkDraft] = useState("");
  const [questions, setQuestions] = useState<{ question: string; answer: string }[]>([]);

  const [location, setLocation] = useState<LocationValue | null>(desk ? { lat: desk.lat, lng: desk.lng, label: desk.placeLabel } : null);
  const now = new Date();
  const [exactTime, setExactTime] = useState(initialKind === "found" || !!desk);
  const [from, setFrom] = useState(toLocalInput(new Date(now.getTime() - (initialKind === "found" ? 0 : 2 * 3600_000))));
  const [to, setTo] = useState(toLocalInput(now));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const setIfUntouched = (field: string, setter: (v: string) => void, v: string) => {
    if (!touched.current.has(field) && v) setter(v);
  };
  const touch = (field: string) => touched.current.add(field);

  function applyAnalysis(a: Analysis) {
    setIfUntouched("category", setCategory, a.category);
    setIfUntouched("title", setTitle, a.title);
    setIfUntouched("description", setDescription, a.description);
    setIfUntouched("color", setColor, a.color);
    setIfUntouched("brand", setBrand, a.brand);
    setIfUntouched("material", setMaterial, a.material);
    if (!touched.current.has("marks") && a.marks.length) setMarks(a.marks);
    if (kind === "found" && !touched.current.has("questions") && a.questions.length) setQuestions(a.questions);
    setAiFilled(true);
  }

  async function analyze(url: string) {
    if (!kind) return;
    setAiState("reading");
    try {
      const { analysis } = await api<{ analysis: Analysis }>("/api/ai/analyze", { body: { url, kind } });
      applyAnalysis(analysis);
      setAiState("done");
    } catch {
      aiStarted.current = false;
      setAiState("busy");
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = 4 - photos.length;
    const list = Array.from(files).slice(0, room);
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { key, preview }]);
      try {
        const small = await resizeImage(file);
        const form = new FormData();
        form.append("file", small);
        const { url } = await api<{ url: string }>("/api/uploads", { body: form });
        setPhotos((p) => p.map((x) => (x.key === key ? { ...x, url } : x)));
        if (!aiStarted.current) {
          aiStarted.current = true;
          void analyze(url);
        }
      } catch (err) {
        setPhotos((p) => p.map((x) => (x.key === key ? { ...x, error: err instanceof Error ? err.message : "Upload failed" } : x)));
      }
    }
  }

  function removePhoto(key: string) {
    setPhotos((p) => p.filter((x) => x.key !== key));
  }

  function validateDetails() {
    const e: Record<string, string> = {};
    if (!category) e.category = "Pick a category";
    if (title.trim().length < 3) e.title = "Give it a short title, like \"Black leather wallet\"";
    if (kind === "found") {
      const valid = questions.filter((q) => q.question.trim().length >= 3 && q.answer.trim());
      if (valid.length === 0) e.questions = "Add at least one question only the owner could answer";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateWhere() {
    const e: Record<string, string> = {};
    if (!location) e.location = "Drop a pin where it was lost or found";
    const f = new Date(from);
    const t = exactTime ? f : new Date(to);
    if (Number.isNaN(f.getTime())) e.when = "Pick a date and time";
    else if (f.getTime() > Date.now() + 10 * 60_000) e.when = "That time is in the future";
    else if (!exactTime && t.getTime() < f.getTime()) e.when = "The end time must be after the start time";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validateDetails()) {
      setStep(1);
      return;
    }
    if (!validateWhere()) return;
    if (photos.some((p) => !p.url && !p.error)) {
      setFormError("Wait for your photos to finish uploading.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const f = new Date(from);
      const res = await api<{ item: { id: string }; matchCount: number }>("/api/items", {
        body: {
          kind,
          category,
          title: title.trim(),
          description: description.trim(),
          color: color.trim(),
          brand: brand.trim(),
          material: material.trim(),
          marks: marks.filter(Boolean),
          photos: photos.filter((p) => p.url).map((p) => p.url),
          lat: location!.lat,
          lng: location!.lng,
          placeLabel: location!.label.trim(),
          occurredFrom: f.toISOString(),
          occurredTo: (exactTime ? f : new Date(to)).toISOString(),
          questions: kind === "found" ? questions.filter((q) => q.question.trim() && q.answer.trim()) : [],
          aiFilled,
          deskId: desk?.id,
        },
      });
      router.push(`/items/${res.item.id}?posted=1`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't post. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (!kind) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-3xl font-extrabold">What happened?</h1>
        <div className="mt-6 grid gap-3">
          <button onClick={() => setKind("lost")} className="flex items-center gap-4 rounded-xl border-2 border-ink bg-surface p-5 text-left hover:bg-wash">
            <span className="flex size-12 items-center justify-center rounded-lg border-2 border-ink">
              <Search className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold">I lost something</span>
              <span className="text-ink-2">We&apos;ll match it against found items and alert you.</span>
            </span>
          </button>
          <button onClick={() => { setKind("found"); setExactTime(true); setFrom(toLocalInput(new Date())); }} className="flex items-center gap-4 rounded-xl border-2 border-signal-deep bg-signal p-5 text-left hover:bg-signal-deep">
            <span className="flex size-12 items-center justify-center rounded-lg bg-ink text-signal">
              <Plus className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold">I found something</span>
              <span className="text-ink/80">Post it and we&apos;ll help you find the owner.</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  const isFound = kind === "found";

  return (
    <div className="mx-auto max-w-xl px-4 pb-32 pt-4">
      <div className="flex items-center gap-2">
        {step > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} icon={<ArrowLeft className="size-4" />}>
            Back
          </Button>
        ) : (
          <Link href={desk ? `/desks` : "/"} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold hover:bg-wash">
            <X className="size-4" aria-hidden /> Cancel
          </Link>
        )}
        <ol className="ml-auto flex items-center gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={cx("h-1.5 w-8 rounded-full", i <= step ? "bg-ink" : "bg-line-strong")} aria-current={i === step ? "step" : undefined}>
              <span className="sr-only">{`Step ${i + 1} of ${STEPS.length}: ${s}`}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 flex items-center gap-2.5">
        <span className={cx("rounded-md px-2 py-0.5 font-display text-sm font-extrabold", isFound ? "bg-signal" : "border-2 border-ink")}>
          {isFound ? "Found" : "Lost"}
        </span>
        {desk && <span className="text-sm text-ink-2">Logging for {desk.name}</span>}
      </div>
      <h1 className="mt-2 text-[28px] font-extrabold leading-tight">
        {step === 0 && (isFound ? "Add a photo of what you found" : "Add a photo, if you have one")}
        {step === 1 && "Describe it"}
        {step === 2 && (isFound ? "Where and when did you find it?" : "Where and when did you lose it?")}
      </h1>

      {formError && (
        <div className="mt-4">
          <Banner tone="error">{formError}</Banner>
        </div>
      )}

      {step === 0 && (
        <section className="mt-5 flex flex-col gap-4">
          <p className="text-ink-2">
            {isFound
              ? "LostLink reads the photo and fills in the details for you. Keep serial numbers and what's inside out of the photo; you'll use those to check the owner."
              : "A photo from your gallery helps finders recognise it. LostLink reads it and fills in the details."}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p) => (
              <div key={p.key} className="relative aspect-square overflow-hidden rounded-lg border border-line-strong bg-wash">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="size-full object-cover" />
                {!p.url && !p.error && <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-2 py-1 text-xs text-paper">Uploading…</div>}
                {p.error && <div className="absolute inset-x-0 bottom-0 bg-alert px-2 py-1 text-xs text-white">{p.error}</div>}
                <button
                  type="button"
                  onClick={() => removePhoto(p.key)}
                  className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-md bg-surface/95 text-ink"
                  aria-label="Remove photo"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <>
                <button
                  type="button"
                  onClick={() => cameraInput.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-surface text-sm font-semibold hover:border-ink"
                >
                  <Camera className="size-6" aria-hidden />
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-surface text-sm font-semibold hover:border-ink"
                >
                  <ImagePlus className="size-6" aria-hidden />
                  From gallery
                </button>
              </>
            )}
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" data-testid="photo-input" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          <AiStatus state={aiState} />
        </section>
      )}

      {step === 1 && (
        <section className="mt-5 flex flex-col gap-5">
          <AiStatus state={aiState} compact />
          <Field label="Category" error={errors.category}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={category === c.id}
                  onClick={() => { touch("category"); setCategory(c.id); }}
                  className={cx(
                    "h-10 rounded-full border px-3.5 text-[15px] font-semibold",
                    category === c.id ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Title" htmlFor="title" error={errors.title} hint="What would you search for? e.g. Black leather wallet">
            <Input id="title" value={title} maxLength={80} onChange={(e) => { touch("title"); setTitle(e.target.value); }} />
          </Field>
          <Field label={isFound ? "Public description" : "Description"} htmlFor="desc" optional hint={isFound ? "Everyone can read this. Leave identifying details for the questions below." : "Anything that helps a finder recognise it."}>
            <Textarea id="desc" value={description} maxLength={1000} onChange={(e) => { touch("description"); setDescription(e.target.value); }} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Color" htmlFor="color" optional>
              <Input id="color" value={color} maxLength={40} onChange={(e) => { touch("color"); setColor(e.target.value); }} />
            </Field>
            <Field label="Brand" htmlFor="brand" optional hint={isFound ? "Hidden from the public" : undefined}>
              <Input id="brand" value={brand} maxLength={40} onChange={(e) => { touch("brand"); setBrand(e.target.value); }} />
            </Field>
            <Field label="Material" htmlFor="material" optional hint={isFound ? "Hidden from the public" : undefined}>
              <Input id="material" value={material} maxLength={40} onChange={(e) => { touch("material"); setMaterial(e.target.value); }} />
            </Field>
          </div>
          <Field label="Distinguishing marks" optional hint={isFound ? "Hidden from the public. Used for matching." : "Stickers, scratches, engravings, keychains."}>
            <div className="flex flex-wrap gap-2">
              {marks.map((m, i) => (
                <span key={`${m}-${i}`} className="inline-flex h-9 items-center gap-1 rounded-full border border-line-strong bg-surface pl-3 pr-1 text-[15px]">
                  {m}
                  <button type="button" aria-label={`Remove ${m}`} className="flex size-7 items-center justify-center rounded-full hover:bg-wash" onClick={() => { touch("marks"); setMarks(marks.filter((_, j) => j !== i)); }}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Add a mark"
                placeholder="e.g. cracked corner"
                value={markDraft}
                maxLength={80}
                onChange={(e) => setMarkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && markDraft.trim()) {
                    e.preventDefault();
                    touch("marks");
                    setMarks([...marks, markDraft.trim()].slice(0, 8));
                    setMarkDraft("");
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => { if (markDraft.trim()) { touch("marks"); setMarks([...marks, markDraft.trim()].slice(0, 8)); setMarkDraft(""); } }}>
                Add
              </Button>
            </div>
          </Field>

          {isFound && (
            <div className="rounded-xl border-2 border-ink bg-surface p-4">
              <div className="flex items-center gap-2">
                <Lock className="size-5" aria-hidden />
                <h2 className="font-display text-lg font-extrabold">Questions only the owner can answer</h2>
              </div>
              <p className="mt-1 text-[15px] text-ink-2">
                Anyone who claims this item must answer these. Only you see the answers. Think: what&apos;s inside, a sticker, the lock screen, a name tag.
              </p>
              {errors.questions && <p className="mt-2 text-sm text-alert" role="alert">{errors.questions}</p>}
              <div className="mt-3 flex flex-col gap-3">
                {questions.map((q, i) => (
                  <div key={i} className="rounded-lg border border-line-strong p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-1 flex-col gap-2">
                        <Input aria-label={`Question ${i + 1}`} placeholder="Question, e.g. What sticker is on the back?" value={q.question} maxLength={160} onChange={(e) => { touch("questions"); setQuestions(questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x))); }} />
                        <Input aria-label={`Answer ${i + 1}`} placeholder="Expected answer (private)" value={q.answer} maxLength={120} onChange={(e) => { touch("questions"); setQuestions(questions.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x))); }} />
                      </div>
                      <button type="button" className="flex size-10 items-center justify-center rounded-md text-ink-2 hover:bg-wash" aria-label={`Remove question ${i + 1}`} onClick={() => { touch("questions"); setQuestions(questions.filter((_, j) => j !== i)); }}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {questions.length < 5 && (
                  <Button type="button" variant="outline" onClick={() => { touch("questions"); setQuestions([...questions, { question: "", answer: "" }]); }} icon={<Plus className="size-4" />}>
                    Add a question
                  </Button>
                )}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-3">
                <EyeOff className="size-4" aria-hidden /> Brand, material and marks are hidden on the public page. The exact spot is blurred to about 300 m.
              </p>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="mt-5 flex flex-col gap-5">
          <Field label="Where" error={errors.location}>
            <LocationField value={location} onChange={setLocation} />
          </Field>
          <Field label="When" error={errors.when}>
            <div className="flex gap-2" role="radiogroup" aria-label="Time precision">
              {[
                { v: true, l: "At a time" },
                { v: false, l: "Sometime between" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={exactTime === o.v}
                  onClick={() => setExactTime(o.v)}
                  className={cx("h-10 rounded-full border px-3.5 text-[15px] font-semibold", exactTime === o.v ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface")}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Input type="datetime-local" aria-label={exactTime ? "Date and time" : "From"} value={from} max={toLocalInput(new Date())} onChange={(e) => setFrom(e.target.value)} />
              {!exactTime && <Input type="datetime-local" aria-label="To" value={to} max={toLocalInput(new Date())} onChange={(e) => setTo(e.target.value)} />}
            </div>
          </Field>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {step === 0 && photos.length === 0 && (
            <Button variant="ghost" onClick={() => setStep(1)} className="mr-auto">
              Skip photos
            </Button>
          )}
          {step < 2 ? (
            <Button
              size="lg"
              variant={isFound ? "signal" : "ink"}
              className="ml-auto min-w-40"
              disabled={step === 0 && photos.some((p) => !p.url && !p.error)}
              onClick={() => {
                if (step === 1 && !validateDetails()) return;
                setStep(step + 1);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button size="lg" variant={isFound ? "signal" : "ink"} className="ml-auto min-w-40" loading={submitting} onClick={submit}>
              {isFound ? "Post found item" : "Post lost item"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AiStatus({ state, compact }: { state: "idle" | "reading" | "done" | "busy"; compact?: boolean }) {
  if (state === "idle") return null;
  if (state === "reading")
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface p-3" role="status">
        <Sparkles className="size-5 animate-pulse" aria-hidden />
        <span className="text-[15px]">Reading your photo to fill in the details…</span>
      </div>
    );
  if (state === "done")
    return compact ? (
      <p className="flex items-center gap-2 text-sm text-ink-2" data-testid="ai-filled">
        <Sparkles className="size-4" aria-hidden /> Filled in from your photo. Check and edit anything that&apos;s off.
      </p>
    ) : (
      <div className="flex items-center gap-3 rounded-lg border border-ink bg-signal-soft p-3" role="status" data-testid="ai-filled">
        <Sparkles className="size-5" aria-hidden />
        <span className="text-[15px]">Details filled in from your photo. You can edit them next.</span>
      </div>
    );
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface p-3" role="status">
      <Sparkles className="size-5 text-ink-3" aria-hidden />
      <span className="text-[15px] text-ink-2">Photo reading is busy right now. Fill in the details yourself; matching still works.</span>
    </div>
  );
}
