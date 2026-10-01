"use client";

/** Last-resort boundary for errors in the root layout (renders its own document). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a", margin: 0 }}>
        <title>JalSuraksha — error</title>
        <main style={{ maxWidth: 420, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>JalSuraksha could not load</h1>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Please try again. In an emergency call <strong>100</strong> (Police) or <strong>102</strong> (Ambulance).
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 12, padding: "10px 18px", borderRadius: 8, border: 0, background: "#0f2447", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          <p style={{ marginTop: 16 }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload is intended when the root layout has crashed */}
            <a href="/citizen/sos" style={{ color: "#b91c1c", fontWeight: 600 }}>Open Emergency SOS</a>
          </p>
        </main>
      </body>
    </html>
  );
}
