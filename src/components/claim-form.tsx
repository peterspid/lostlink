"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { Banner, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function ClaimForm({
  itemId,
  questions,
  myLost,
  defaultLostId,
}: {
  itemId: string;
  questions: { id: string; question: string }[];
  myLost: { id: string; title: string; code: string }[];
  defaultLostId: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lostItemId, setLostItemId] = useState(defaultLostId ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const empty = new Set(questions.filter((q) => !answers[q.id]?.trim()).map((q) => q.id));
    setMissing(empty);
    if (empty.size) {
      setError("Answer every question so the finder can check it's yours.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/claims", {
        body: {
          itemId,
          lostItemId: lostItemId || null,
          answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id].trim() })),
          note: note.trim(),
        },
      });
      router.push(`/chats/${id}?claimed=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your claim. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && <Banner tone="error">{error}</Banner>}
      {questions.map((q, i) => (
        <Field key={q.id} label={q.question} htmlFor={`a-${q.id}`} error={missing.has(q.id) ? "Answer this question" : null}>
          <Input
            id={`a-${q.id}`}
            value={answers[q.id] ?? ""}
            maxLength={200}
            autoFocus={i === 0}
            aria-invalid={missing.has(q.id)}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            data-testid="claim-answer"
          />
        </Field>
      ))}
      {myLost.length > 0 && (
        <Field label="Which of your lost reports is this?" htmlFor="lost" optional>
          <Select id="lost" value={lostItemId} onChange={(e) => setLostItemId(e.target.value)}>
            <option value="">None of them</option>
            {myLost.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} ({l.code})
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Message to the finder" htmlFor="note" optional hint="Anything else that proves it's yours. Don't share your phone number; you'll chat here.">
        <Textarea id="note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" variant="signal" loading={busy} icon={<Lock className="size-4" aria-hidden />} data-testid="claim-submit">
        Send claim to the finder
      </Button>
      <p className="text-sm text-ink-3">Only the finder sees your answers. Repeated wrong claims are blocked.</p>
    </form>
  );
}
