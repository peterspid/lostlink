import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await currentUser()) redirect(nextPath && nextPath.startsWith("/") ? nextPath : "/");
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-ink-2">
        Takes 20 seconds. You&apos;ll chat with finders and owners inside LostLink, so your phone number and email stay private.
      </p>
      <div className="mt-8">
        <AuthForm mode="signup" next={nextPath} />
      </div>
    </div>
  );
}
