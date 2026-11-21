"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui";

/** Share via the native share sheet when available, otherwise copy the link. */
export function CopyLink({ path, label = "Share this post" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      icon={copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          if (navigator.share) {
            await navigator.share({ url, title: document.title });
            return;
          }
        } catch {
          /* fall back to copy */
        }
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Link copied" : label}
    </Button>
  );
}
