import { ItemTagSkeleton } from "@/components/item-tag";
import { Skeleton } from "@/components/ui";

/** Shown instantly while a page's data loads on navigation. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2.5 pt-1">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <ItemTagSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
