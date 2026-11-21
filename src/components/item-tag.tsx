import Link from "next/link";
import { ViewTransition } from "react";
import {
  Backpack,
  BookOpen,
  Building2,
  Clock,
  GlassWater,
  Glasses,
  Headphones,
  IdCard,
  KeyRound,
  MapPin,
  Navigation,
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

/** Shared-element name so a list photo morphs into the item page hero on navigation. */
export const photoTransitionName = (id: string) => `item-photo-${id}`;

export function Thumb({ item, size = "md", morph = false }: { item: Pick<TagItem, "id" | "photos" | "category" | "kind">; size?: "sm" | "md" | "lg"; morph?: boolean }) {
  const dims = size === "sm" ? "size-12 rounded-lg" : size === "lg" ? "size-24 rounded-xl" : "size-[76px] rounded-xl";
  const el = item.photos[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.photos[0]} alt="" loading="lazy" decoding="async" className={cx(dims, "shrink-0 border border-line bg-wash object-cover")} />
  ) : (
    <div className={cx(dims, "flex shrink-0 items-center justify-center", item.kind === "found" ? "bg-signal-soft text-ink" : "bg-wash text-ink")}>
      <CategoryIcon category={item.category} className={size === "sm" ? "size-5" : "size-7"} />
    </div>
  );
  if (!morph) return el;
  return (
    <ViewTransition name={photoTransitionName(item.id)} share="morph" default="none">
      {el}
    </ViewTransition>
  );
}

/**
 * A list row cut like a claim ticket: the item on the left, and a perforated stub on the
 * right with the punched hole and the reference code staff write on the shelf label.
 */
export function ItemTag({ item, href, extra, showStatus }: { item: TagItem; href?: string; extra?: React.ReactNode; showStatus?: boolean }) {
  return (
    <Link
      href={href ?? `/items/${item.id}`}
      className="group relative flex overflow-hidden rounded-[var(--radius-tag)] border border-line bg-surface transition-[border-color,box-shadow] duration-200 hover:border-ink/60 hover:shadow-[var(--shadow-lift)]"
      data-testid="item-tag"
    >
      <div className="flex min-w-0 flex-1 gap-3.5 p-3">
        <Thumb item={item} morph />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <KindMark kind={item.kind} size="sm" />
            {showStatus && item.status !== "open" && <StatusPill status={item.status} className="h-5 text-[12px]" />}
            {item.distanceM != null && (
              <span className="inline-flex items-center gap-1 text-[13px] font-bold text-ink">
                <Navigation className="size-3" aria-hidden />
                {formatDistance(item.distanceM)}
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate font-display text-[17px] font-bold leading-snug group-hover:underline group-hover:decoration-signal group-hover:decoration-2 group-hover:underline-offset-4">
            {item.title}
          </p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-2">
            {(item.deskName || item.placeLabel) && (
              <span className="inline-flex min-w-0 items-center gap-1">
                {item.deskName ? <Building2 className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
                <span className="truncate">{item.deskName ?? item.placeLabel}</span>
              </span>
            )}
            <span className="inline-flex shrink-0 items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {timeAgo(item.occurredFrom)}
            </span>
          </div>
          {extra}
        </div>
      </div>
      <div className="perforation-y w-px shrink-0" aria-hidden />
      <div className={cx("flex w-14 shrink-0 flex-col items-center justify-between py-3", item.kind === "found" ? "bg-signal-soft" : "bg-wash")}>
        <span className="sway-on-hover size-3 origin-top rounded-full border-2 border-ink/70 bg-paper" aria-hidden />
        <span className="ref-code text-[11px] text-ink [writing-mode:vertical-rl]" aria-label={`Reference ${item.code}`}>
          {item.code}
        </span>
      </div>
    </Link>
  );
}

/** Placeholder rows while a list loads. */
export function ItemTagSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-[var(--radius-tag)] border border-line bg-surface" aria-hidden>
      <div className="flex flex-1 gap-3.5 p-3">
        <div className="skeleton size-[76px] shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="skeleton h-4 w-14" />
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-3.5 w-1/2" />
        </div>
      </div>
      <div className="w-14 bg-wash" />
    </div>
  );
}
