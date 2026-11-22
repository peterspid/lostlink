"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, LinkButton, Pictogram } from "@/components/ui";

/** Unexpected errors inside a page: explain, offer a retry, keep the app shell. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[page] unexpected error", error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <Pictogram size="lg" tone="signal">
        <TriangleAlert />
      </Pictogram>
      <h1 className="mt-6 text-[32px] font-black leading-tight">This page didn&apos;t load</h1>
      <p className="mt-2 text-[17px] text-ink-2">Something went wrong on our side or the connection dropped. Your posts and chats are safe.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button onClick={retry} icon={<RotateCw className="size-4" aria-hidden />}>
          Try again
        </Button>
        <LinkButton href="/" variant="outline">
          Home
        </LinkButton>
      </div>
    </div>
  );
}
