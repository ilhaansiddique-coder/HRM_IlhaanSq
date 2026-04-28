"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html>
      <body style={{ margin: 0, padding: "2rem", fontFamily: "system-ui" }}>
        <h1>Error</h1>
        <p>{error?.message || "An error occurred"}</p>
      </body>
    </html>
  );
}
