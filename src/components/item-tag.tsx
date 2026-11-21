import Link from "next/link";
import {
  Backpack,
  BookOpen,
  Clock,
  GlassWater,
  Glasses,
  Headphones,
  IdCard,
  KeyRound,
  MapPin,
  Package,
  PawPrint,
  Shirt,
  Smartphone,
  ToyBrick,
  Umbrella,
  Wallet,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { KindMark, StatusPill } from "@/components/ui";
import { cx } from "@/lib/cx";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/time";

const ICONS: Record<string, LucideIcon> = {
  phone: Smartphone,
  wallet: Wallet,
  keys: KeyRound,
  bag: Backpack,
  "id-card": IdCard,
  electronics: Headphones,
  jewelry: Watch,
  clothing: Shirt,
  eyewear: Glasses,
  documents: BookOpen,
  bottle: GlassWater,
  umbrella: Umbrella,
  toy: ToyBrick,
  pet: PawPrint,
  other: Package,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category] ?? Package;
  return <Icon className={className} aria-hidden />;
}

export interface TagItem {
  id: string;
  code: string;
  kind: "lost" | "found";
  status: string;
  category: string;
  title: string;
  photos: string[];
  placeLabel: string;
  occurredFrom: string;
  createdAt: string;
  distanceM?: number | null;
  deskName?: string | null;
}

export function Thumb({ item, size = "md" }: { item: Pick<TagItem, "photos" | "category" | "kind">; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "size-12" : size === "lg" ? "size-24" : "size-[72px]";
  return item.photos[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.photos[0]} alt="" loading="lazy" className={cx(dims, "shrink-0 rounded-md border border-line object-cover")} />
  ) : (
    <div className={cx(dims, "flex shrink-0 items-center justify-center rounded-md border", item.kind === "found" ? "border-signal-deep/40 bg-signal-soft" : "border-line bg-wash")}>
      <CategoryIcon category={item.category} className="size-7 text-ink" />
    </div>
  );
}

/** A list row styled like a lost-property tag: photo, kind, title, where/when, reference code. */
export function ItemTag({ item, href, extra, showStatus }: { item: TagItem; href?: string; extra?: React.ReactNode; showStatus?: boolean }) {
  return (
    <Link
      href={href ?? `/items/${item.id}`}
      className="group flex gap-3.5 rounded-[var(--radius-tag)] border border-line bg-surface p-3 transition-colors hover:border-ink"
      data-testid="item-tag"
    >
      <Thumb item={item} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <KindMark kind={item.kind} />
          {showStatus && item.status !== "open" && <StatusPill status={item.status} />}
          <span className="ref-code ml-auto text-xs text-ink-3">{item.code}</span>
        </div>
        <p className="mt-1.5 truncate font-display text-[17px] font-bold leading-snug">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-2">
          {item.placeLabel && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{item.deskName ?? item.placeLabel}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {timeAgo(item.occurredFrom)}
          </span>
          {item.distanceM != null && <span className="font-semibold text-ink">{formatDistance(item.distanceM)}</span>}
        </div>
        {extra}
      </div>
    </Link>
  );
}
