export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public aiBusy = false,
  ) {
    super(message);
  }
}

/** JSON fetch for our own API with readable errors and one retry on network failure. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const opts: RequestInit = {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body),
    signal: init.signal,
    credentials: "same-origin",
  };
  let res: Response;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    await new Promise((r) => setTimeout(r, 600));
    try {
      res = await fetch(url, opts);
    } catch {
      throw new ApiError("You seem to be offline. Check your connection and try again.", 0);
    }
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; aiBusy?: boolean };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (!window.location.pathname.startsWith("/login")) window.location.href = `/login?next=${next}`;
    }
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, !!data.aiBusy);
  }
  return data as T;
}
