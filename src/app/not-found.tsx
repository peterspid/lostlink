import { Search } from "lucide-react";
import { LinkButton } from "@/components/ui";

/** A page that went missing, filed like any other lost item. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="relative flex w-56 rotate-[-4deg] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[var(--shadow-float)]" aria-hidden>
        <div className="flex flex-1 flex-col items-start gap-1 p-4">
          <span className="kind-tag inline-flex h-5 items-center rounded-r-[5px] bg-ink pr-2 font-display text-[12px] font-extrabold text-paper">Lost</span>
          <span className="font-display text-[17px] font-black">This page</span>
          <span className="text-xs text-ink-3">Last seen: just now</span>
        </div>
        <div className="perforation-y w-px" />
        <div className="flex w-14 flex-col items-center justify-between bg-wash py-3">
          <span className="size-3 rounded-full border-2 border-ink/70 bg-paper" />
          <span className="ref-code text-[13px] [writing-mode:vertical-rl]">404</span>
        </div>
      </div>
      <h1 className="mt-10 text-[34px] font-black leading-tight">This page isn&apos;t here</h1>
      <p className="mt-2 text-[17px] text-ink-2">The post may have been returned, closed or removed. Try browsing what&apos;s been handed in recently.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <LinkButton href="/browse" icon={<Search className="size-4" aria-hidden />}>
          Browse items
        </LinkButton>
        <LinkButton href="/" variant="outline">
          Home
        </LinkButton>
      </div>
    </div>
  );
}
