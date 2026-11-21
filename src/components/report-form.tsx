"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, EyeOff, ImagePlus, Lock, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { api, ApiError } from "@/lib/client-api";
import { resizeImage } from "@/lib/image-resize";
import { LocationField, type LocationValue } from "@/components/location-field";
import { CategoryIcon } from "@/components/item-tag";
import { Banner, Button, Field, Input, KindMark, Textarea, cx } from "@/components/ui";

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
    const choices = [
      { k: "lost" as const, label: "I lost something", sub: "We match it against found items and alert you.", icon: Search, plate: "bg-paper text-ink" },
      { k: "found" as const, label: "I found something", sub: "Post it and we help you find the owner.", icon: Plus, plate: "bg-signal text-ink" },
    ];
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-[38px] font-black leading-[1.02]">What happened?</h1>
        <p className="mt-2 text-[17px] text-ink-2">Takes under a minute. You can edit everything afterwards.</p>
        <div className="on-ink mt-7 overflow-hidden rounded-[28px] bg-ink text-paper shadow-[var(--shadow-float)]">
          {choices.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.k}
                type="button"
                onClick={() => {
                  setKind(c.k);
                  if (c.k === "found") {
                    setExactTime(true);
                    setFrom(toLocalInput(new Date()));
                  }
                }}
                className={cx("group flex w-full items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-white/[0.06]", i > 0 && "border-t border-white/10")}
              >
                <span className={cx("flex size-14 shrink-0 items-center justify-center rounded-2xl", c.plate)}>
                  <Icon className="size-7" strokeWidth={2.6} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[22px] font-extrabold leading-tight">{c.label}</span>
                  <span className="text-[15px] text-paper/70">{c.sub}</span>
                </span>
                <ArrowRight className="size-6 shrink-0 text-signal transition-transform group-hover:translate-x-1" aria-hidden />
              </button>
            );
          })}
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
        <span className="ml-auto text-sm font-semibold text-ink-3">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <span className="block h-1.5 overflow-hidden rounded-full bg-line-strong">
              <span className={cx("block h-full origin-left rounded-full bg-ink transition-transform duration-500 ease-[var(--ease-out-soft)]", i <= step ? "scale-x-100" : "scale-x-0")} />
            </span>
            <span className={cx("mt-1.5 flex items-center gap-1 font-display text-[12px] font-bold", i === step ? "text-ink" : "text-ink-3")}>
              {i < step && <Check className="size-3 text-go" strokeWidth={3} aria-hidden />}
              {s}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-center gap-2.5">
        <KindMark kind={isFound ? "found" : "lost"} />
        {desk && <span className="text-sm font-semibold text-ink-2">Logging for {desk.name}</span>}
      </div>
      <h1 key={step} className="animate-rise mt-2 text-[30px] font-black leading-[1.05] md:text-[34px]">
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
              <div key={p.key} className="animate-rise relative aspect-square overflow-hidden rounded-2xl border border-line-strong bg-wash">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="size-full object-cover" />
                {((!p.url && !p.error) || (aiState === "reading" && p.key === photos[0]?.key)) && <span className="scan-line" aria-hidden />}
                {!p.url && !p.error && <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-2 py-1.5 text-xs font-semibold text-paper">Uploading…</div>}
                {p.error && <div className="absolute inset-x-0 bottom-0 bg-alert px-2 py-1.5 text-xs font-semibold text-white">{p.error}</div>}
                <button
                  type="button"
                  onClick={() => removePhoto(p.key)}
                  className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-xl bg-surface/95 text-ink shadow-[var(--shadow-lift)] hover:text-alert"
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
                  className="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl bg-ink font-display text-[15px] font-bold text-paper transition-transform hover:bg-night active:scale-[0.98]"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-signal text-ink">
                    <Camera className="size-6" aria-hidden />
                  </span>
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-line-strong bg-surface font-display text-[15px] font-bold transition-colors hover:border-ink active:scale-[0.98]"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-wash">
                    <ImagePlus className="size-6" aria-hidden />
                  </span>
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
                    "inline-flex h-10 items-center gap-1.5 rounded-full border pl-3 pr-3.5 text-[15px] font-semibold transition-colors",
                    category === c.id ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink",
                  )}
                >
                  <CategoryIcon category={c.id} className={cx("size-4", category === c.id && "text-signal")} />
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
            <div className="overflow-hidden rounded-3xl border border-ink bg-surface">
              <div className="on-ink flex items-center gap-2.5 bg-ink px-4 py-3 text-paper">
                <span className="flex size-8 items-center justify-center rounded-lg bg-signal text-ink">
                  <Lock className="size-4" aria-hidden />
                </span>
                <h2 className="font-display text-lg font-extrabold">Questions only the owner can answer</h2>
              </div>
              <div className="p-4">
              <p className="text-[15px] text-ink-2">
                Anyone who claims this item must answer these. Only you see the answers. Think: what&apos;s inside, a sticker, the lock screen, a name tag.
              </p>
              {errors.questions && <p className="mt-2 text-sm text-alert" role="alert">{errors.questions}</p>}
              <div className="mt-3 flex flex-col gap-3">
                {questions.map((q, i) => (
                  <div key={i} className="animate-rise rounded-2xl border border-line-strong bg-paper/60 p-3">
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
              <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-3">
                <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden /> Brand, material and marks are hidden on the public page. The exact spot is blurred to about 300 m.
              </p>
              </div>
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
            <div className="flex w-fit gap-1 rounded-full border border-line-strong bg-surface p-1" role="radiogroup" aria-label="Time precision">
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
                  className={cx("h-9 rounded-full px-4 text-[15px] font-semibold transition-colors", exactTime === o.v ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
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

      <div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 backdrop-blur-md" style={{ paddingBottom: "var(--safe-bottom)" }}>
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
              <ArrowRight className="size-5" aria-hidden />
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
      <div className="animate-rise flex items-center gap-3 rounded-2xl border border-line-strong bg-surface p-3.5" role="status">
        <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-signal">
          <Sparkles className="size-5 animate-pulse" aria-hidden />
        </span>
        <span className="text-[15px]">Reading your photo to fill in the details…</span>
      </div>
    );
  if (state === "done")
    return compact ? (
      <p className="flex items-center gap-2 text-sm text-ink-2" data-testid="ai-filled">
        <Sparkles className="size-4" aria-hidden /> Filled in from your photo. Check and edit anything that&apos;s off.
      </p>
    ) : (
      <div className="animate-rise flex items-center gap-3 rounded-2xl border border-go/35 bg-go-soft p-3.5" role="status" data-testid="ai-filled">
        <span className="flex size-9 items-center justify-center rounded-xl bg-go text-white">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <span className="text-[15px]">Details filled in from your photo. You can edit them next.</span>
      </div>
    );
  return (
    <div className="animate-rise flex items-center gap-3 rounded-2xl border border-line-strong bg-surface p-3.5" role="status">
      <span className="flex size-9 items-center justify-center rounded-xl bg-wash text-ink-3">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <span className="text-[15px] text-ink-2">Photo reading is busy right now. Fill in the details yourself; matching still works.</span>
    </div>
  );
}
