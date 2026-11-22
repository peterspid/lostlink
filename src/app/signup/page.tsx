import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await currentUser()) redirect(safeNext(nextPath));
  return (
    <AuthShell title="Create your account" lede="Takes 20 seconds. You chat with finders and owners inside LostLink, so your phone number and email stay private.">
      <AuthForm mode="signup" next={nextPath} />
    </AuthShell>
  );
}
