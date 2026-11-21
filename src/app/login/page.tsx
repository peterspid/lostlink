import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await currentUser()) redirect(nextPath && nextPath.startsWith("/") ? nextPath : "/");
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-extrabold">Sign in</h1>
      <p className="mt-2 text-ink-2">Pick up where you left off: your posts, matches and chats.</p>
      <div className="mt-8">
        <AuthForm mode="login" next={nextPath} />
      </div>
    </div>
  );
}
