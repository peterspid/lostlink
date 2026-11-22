import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await currentUser()) redirect(safeNext(nextPath));
  return (
    <AuthShell title="Welcome back" lede="Pick up where you left off: your posts, matches and chats.">
      <AuthForm mode="login" next={nextPath} />
    </AuthShell>
  );
}
