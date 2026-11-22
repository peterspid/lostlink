/**
 * Only same-site paths are allowed as post-login destinations. Rejects protocol-relative
 * ("//evil.com") and backslash variants ("/\evil.com") that browsers treat as other origins.
 */
export function safeNext(next: string | undefined | null, fallback = "/"): string {
  if (!next || !next.startsWith("/") || /^\/[\\/]/.test(next) || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
