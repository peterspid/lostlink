"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { safeNext } from "@/lib/safe-next";
import { Banner, Button, Field, Input } from "@/components/ui";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = safeNext(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        body: mode === "login" ? { email, password } : { name, email, password },
      });
      // Full navigation so the server layout picks up the new session and chat connects.
      window.location.assign(target);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && <Banner tone="error">{error}</Banner>}
      {mode === "signup" && (
        <Field label="Your name" htmlFor="name" hint="Only your first name is shown to others.">
          <Input id="name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={reveal ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 8 : 1}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-wash hover:text-ink"
            aria-label={reveal ? "Hide what you typed" : "Show what you typed"}
            aria-pressed={reveal}
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-[15px] text-ink-2">
        {mode === "login" ? (
          <>
            New to LostLink?{" "}
            <Link className="font-bold text-ink underline decoration-signal decoration-2 underline-offset-4 hover:decoration-ink" href={`/signup?next=${encodeURIComponent(target)}`}>
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link className="font-bold text-ink underline decoration-signal decoration-2 underline-offset-4 hover:decoration-ink" href={`/login?next=${encodeURIComponent(target)}`}>
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
