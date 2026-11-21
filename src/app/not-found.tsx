import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="ref-code text-sm text-ink-3">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">This page isn&apos;t here</h1>
      <p className="mt-2 text-ink-2">The post may have been returned, closed or removed. Try browsing what&apos;s been handed in recently.</p>
      <div className="mt-6 flex gap-2">
        <LinkButton href="/browse">Browse items</LinkButton>
        <LinkButton href="/" variant="outline">
          Home
        </LinkButton>
      </div>
    </div>
  );
}
