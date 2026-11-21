"use client";

import Link from "next/link";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";

import { cx } from "@/lib/cx";
export { cx };

type Variant = "signal" | "ink" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  signal: "bg-signal text-ink hover:bg-signal-deep border border-signal-deep/40",
  ink: "bg-ink text-paper hover:bg-ink/90 border border-ink",
  outline: "bg-surface text-ink border border-line-strong hover:border-ink",
  ghost: "bg-transparent text-ink hover:bg-wash border border-transparent",
  danger: "bg-surface text-alert border border-alert/40 hover:bg-alert-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-14 px-5 text-base gap-2.5",
};

export function buttonClass(variant: Variant = "ink", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none",
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
  { variant = "ink", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
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
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-3"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-3">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-alert" role="alert">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-ink/15 aria-[invalid=true]:border-alert";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, "h-12", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(inputBase, "min-h-24 py-3 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx(inputBase, "h-12 appearance-none bg-[length:16px] pr-9", className)} {...rest} />;
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
    info: "bg-surface border-line-strong text-ink",
    error: "bg-alert-soft border-alert/40 text-ink",
    success: "bg-surface border-ink text-ink",
    signal: "bg-signal-soft border-signal-deep/50 text-ink",
  }[tone];
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={cx("flex items-start gap-3 rounded-lg border p-3.5", styles)} role={tone === "error" ? "alert" : "status"}>
      <Icon className={cx("mt-0.5 size-5 shrink-0", tone === "error" ? "text-alert" : "text-ink")} aria-hidden />
      <div className="min-w-0 flex-1 text-[15px]">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-ink-2" : ""}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Dismiss">
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

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong bg-surface/60 p-6">
      {icon && <div className="flex size-11 items-center justify-center rounded-lg bg-wash text-ink">{icon}</div>}
      <div>
        <p className="font-display text-lg font-bold">{title}</p>
        {children && <div className="mt-1 max-w-prose text-[15px] text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Lost = ink outline tag, Found = signal-filled tag. */
export function KindMark({ kind, className }: { kind: "lost" | "found"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-[5px] px-2 font-display text-[13px] font-extrabold leading-none",
        kind === "found" ? "bg-signal text-ink" : "border-[1.5px] border-ink text-ink",
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

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const strong = status === "returned" || status === "approved" || status === "claimed";
  const bad = status === "rejected" || status === "hidden";
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold",
        strong ? "bg-ink text-paper" : bad ? "bg-alert-soft text-alert" : "bg-wash text-ink-2",
        className,
      )}
    >
      {status === "returned" && <CheckCircle2 className="size-3.5" aria-hidden />}
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
