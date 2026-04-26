"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Triggers an XLSX export of the currently-filtered Reports view.
// We hit the export route with the same URL params that drive the
// page so the spreadsheet always mirrors what's on screen.
//
// The route streams a binary blob; we materialize it to a Blob URL so
// we can drive a same-tab anchor download. That avoids the popup
// blockers that fire when you `window.open` from a non-user-initiated
// flow, and keeps the Excel file out of any browser history.
export function ReportsExportButton() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const url = new URL("/api/reports/export", window.location.origin);
      params.forEach((value, key) => url.searchParams.set(key, value));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `reports-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after the click so Safari/Chrome have time to
      // resolve the URL — immediate revoke can race the download.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error("[reports-export]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={loading}
            className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
            aria-label="Export reports"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export current view (Excel)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
