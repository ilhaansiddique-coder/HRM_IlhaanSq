"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Last-resort error boundary for any tenant page that throws BELOW the
// (tenant) layout. Page-level try/catch (see PageErrorState) handles
// expected data-fetch failures with rich detail; this boundary catches
// anything that escapes that — render-time exceptions in a Server
// Component, unhandled promise rejections during streaming, etc.
//
// Production sanitises `error.message` before it reaches the client,
// so we surface `error.digest` (the stable hash that maps to the
// server-side error log) and offer reset() to retry the segment.
export default function TenantSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[tenant segment error]", error);
  }, [error]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-destructive">
                This page hit an error
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Something went wrong while rendering this page. You can retry,
                or share the digest below with support.
              </p>
            </div>
            <div className="space-y-1 text-xs">
              {error.digest && (
                <p>
                  <span className="text-muted-foreground">Digest:</span>{" "}
                  <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-destructive">
                    {error.digest}
                  </code>
                </p>
              )}
              {error.message && (
                <p className="text-destructive break-words">{error.message}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reset()}
              className="gap-2"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
