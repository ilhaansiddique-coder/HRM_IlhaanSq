import { AlertTriangle } from "lucide-react";

// Inline error fallback for server-side data-fetch failures on tenant
// pages. Rendering the message as part of the page (instead of letting
// Next bubble it up to the framework's 500 boundary) keeps the route
// loadable and surfaces the real reason — Next strips error.message
// out in production builds before it reaches a client error.tsx, so
// without this the user just sees "Internal Server Error" with no
// signal of what actually broke.
//
// We log to console.error too so the same line shows up in Vercel
// Function Logs, paired with the inline render — gives the user two
// places to read the error from.
export function PageErrorState({
  title,
  error,
  hint,
}: {
  title: string;
  error: unknown;
  hint?: string;
}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack =
    error instanceof Error && typeof error.stack === "string"
      ? error.stack
      : null;

  // eslint-disable-next-line no-console
  console.error(`[${title}] failed to load:`, error);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-destructive">
                {title} failed to load
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hint ??
                  "The server hit an error while fetching the data for this page. Refresh to retry — if it keeps happening, share the message below."}
              </p>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-background/60 p-3 text-xs text-destructive">
              {message}
            </pre>
            {stack && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Show stack trace
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-background/60 p-3 text-[11px] text-muted-foreground">
                  {stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
