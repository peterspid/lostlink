"use client";

/** Last-resort boundary when the root layout itself fails: plain HTML, no app chrome. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f2f3ee", color: "#10243a", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>LostLink couldn&apos;t load</h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, opacity: 0.8 }}>Check your connection and try again. Your posts and chats are safe.</p>
          <button onClick={retry} style={{ marginTop: 12, height: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#10243a", color: "#f2f3ee", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
