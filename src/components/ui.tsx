"use client";

import Link from "next/link";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2, X } from "lucide-react";

import { cx } from "@/lib/cx";
export { cx };

type Variant = "signal" | "ink" | "outline" | "ghost" | "danger" | "paper";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  signal: "bg-signal text-ink hover:bg-signal-deep shadow-[var(--shadow-key)]",
  ink: "bg-ink text-paper hover:bg-night shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)]",
  outline: "bg-surface text-ink border border-line-strong hover:border-ink",
  ghost: "bg-transparent text-ink hover:bg-wash",
  danger: "bg-surface text-alert border border-alert/35 hover:bg-alert-soft hover:border-alert/60",
  paper: "bg-paper text-ink hover:bg-white shadow-[var(--shadow-key)]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-[10px]",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-14 px-6 text-[17px] gap-2.5 rounded-2xl",
};

export function buttonClass(variant: Variant = "ink", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center font-display font-bold tracking-[-0.01em] select-none whitespace-nowrap",
    "transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:translate-y-px active:scale-[0.985]",
    "disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ink", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = "ink",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children: ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-display text-[15px] font-bold text-ink">
        {label}
        {optional && <span className="font-sans text-sm font-normal text-ink-3"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-3">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-alert" role="alert">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink/40 focus:border-ink focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-signal/35 aria-[invalid=true]:border-alert aria-[invalid=true]:focus:ring-alert/20 disabled:bg-wash";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, "h-12", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(inputBase, "min-h-28 py-3 leading-relaxed", className)} {...rest} />;
});

/** Native select (best on phones) with a drawn chevron, since appearance-none removes the browser's. */
const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2310243a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[position:right_0.85rem_center] bg-no-repeat";

/** `compact` is the pill-shaped filter size used in toolbars. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }>(function Select({ className, compact, ...rest }, ref) {
  const base = compact ? inputBase.replace("w-full rounded-xl", "w-auto rounded-full") : inputBase;
  return <select ref={ref} className={cx(base, chevron, compact ? "h-9 pr-9" : "h-12 pr-10", "cursor-pointer appearance-none", className)} {...rest} />;
});

export function Banner({
  tone = "info",
  title,
  children,
  action,
  onClose,
}: {
  tone?: "info" | "error" | "success" | "signal";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
}) {
  const styles = {
    info: "bg-surface border-line-strong",
    error: "bg-alert-soft border-alert/35",
    success: "bg-go-soft border-go/35",
    signal: "bg-signal-soft border-signal-deep/45",
  }[tone];
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={cx("animate-rise flex items-start gap-3 rounded-2xl border p-4 text-ink", styles)} role={tone === "error" ? "alert" : "status"}>
      <Icon className={cx("mt-0.5 size-5 shrink-0", tone === "error" ? "text-alert" : tone === "success" ? "text-go" : "text-ink")} aria-hidden />
      <div className="min-w-0 flex-1 text-[15px]">
        {title && <p className="font-display font-bold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-ink-2" : ""}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="-m-1 rounded-lg p-1.5 text-ink-3 hover:bg-ink/5 hover:text-ink" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-ink-3", className)} role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </span>
  );
}

/** A wayfinding pictogram plate: the icon on a navy (or yellow) sign square. */
export function Pictogram({ children, tone = "ink", size = "md", className }: { children: ReactNode; tone?: "ink" | "signal" | "wash" | "go"; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center [&>svg]:shrink-0",
        size === "sm" ? "size-9 rounded-[10px] [&>svg]:size-[18px]" : size === "lg" ? "size-14 rounded-2xl [&>svg]:size-7" : "size-11 rounded-xl [&>svg]:size-[22px]",
        tone === "ink" && "bg-ink text-signal",
        tone === "signal" && "bg-signal text-ink",
        tone === "wash" && "bg-wash text-ink",
        tone === "go" && "bg-go text-white",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Consistent page heading: optional back link, pictogram plate, title, lede and actions. */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cx("flex flex-col gap-4", className)}>
      {back && (
        <Link href={back.href} className="-ml-2 inline-flex h-9 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-wash hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon && <Pictogram>{icon}</Pictogram>}
          <div className="min-w-0">
            <h1 className="text-[30px] font-black leading-[1.05] md:text-[38px]">{title}</h1>
            {description && <p className="mt-1.5 max-w-prose text-[16px] text-ink-2">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" | "article" }) {
  return <As className={cx("rounded-2xl border border-line bg-surface", className)}>{children}</As>;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="animate-rise relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface/70 p-6">
      {icon && <Pictogram tone="wash">{icon}</Pictogram>}
      <div>
        <p className="font-display text-lg font-extrabold">{title}</p>
        {children && <div className="mt-1 max-w-prose text-[15px] text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

/** Initials on a sign plate. Never a photo: LostLink doesn't collect profile pictures. */
export function Avatar({ name, size = "md", tone = "ink", className }: { name: string; size?: "sm" | "md" | "lg"; tone?: "ink" | "signal" | "wash"; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold leading-none",
        size === "sm" ? "size-8 text-[13px]" : size === "lg" ? "size-16 text-2xl" : "size-11 text-base",
        tone === "ink" && "bg-ink text-signal",
        tone === "signal" && "bg-signal text-ink",
        tone === "wash" && "bg-wash text-ink",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Lost = navy tag, Found = yellow tag. Both are cut like a luggage tag with a punched hole. */
export function KindMark({ kind, className, size = "md", onDark }: { kind: "lost" | "found"; className?: string; size?: "sm" | "md"; onDark?: boolean }) {
  return (
    <span
      className={cx(
        "kind-tag inline-flex items-center rounded-r-[5px] pr-2 font-display font-extrabold leading-none",
        size === "sm" ? "h-5 text-[12px]" : "h-6 text-[13px]",
        kind === "found" ? "bg-signal text-ink" : onDark ? "bg-paper text-ink" : "bg-ink text-paper",
        className,
      )}
    >
      {kind === "found" ? "Found" : "Lost"}
    </span>
  );
}

const statusText: Record<string, string> = {
  open: "Open",
  claimed: "Claim approved",
  returned: "Returned",
  closed: "Closed",
  expired: "Expired",
  hidden: "Hidden",
  pending: "Waiting for finder",
  approved: "Approved",
  rejected: "Declined",
  cancelled: "Withdrawn",
};

const statusTone: Record<string, string> = {
  returned: "bg-go text-white",
  approved: "bg-go-soft text-go",
  claimed: "bg-go-soft text-go",
  pending: "bg-signal-soft text-ink",
  rejected: "bg-alert-soft text-alert",
  hidden: "bg-alert-soft text-alert",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold", statusTone[status] ?? "bg-wash text-ink-2", className)}>
      {status === "returned" && <CheckCircle2 className="size-3.5" aria-hidden />}
      {status === "pending" && <span className="size-1.5 animate-pulse rounded-full bg-signal-deep" aria-hidden />}
      {statusText[status] ?? status}
    </span>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function useFieldId(prefix: string) {
  const id = useId();
  return `${prefix}-${id.replace(/:/g, "")}`;
}
