"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Marks itself `data-shown` the first time it scrolls into view, so CSS can play
 * `[data-reveal]` children in sequence. Written straight to the DOM: no re-render.
 */
export function Reveal({
  children,
  className,
  style,
  threshold = 0.3,
  onShow,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  threshold?: number;
  onShow?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onShowRef = useRef(onShow);
  useEffect(() => {
    onShowRef.current = onShow;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      el.setAttribute("data-shown", "");
      onShowRef.current?.();
    };
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Publishes scroll progress through the element as `--p` (0 → 1): 0 when its top reaches
 * `start` of the viewport height, 1 when its bottom reaches `end`. Reduced motion pins it at 1.
 */
export function ScrollProgress({ children, className, start = 0.8, end = 0.55 }: { children: ReactNode; className?: string; start?: number; end?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const distance = r.height + vh * (start - end);
      const travelled = vh * start - r.top;
      const p = Math.min(1, Math.max(0, travelled / distance));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [start, end]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
