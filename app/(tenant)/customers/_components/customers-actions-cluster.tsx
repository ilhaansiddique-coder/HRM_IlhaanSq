"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Loader2, Plus, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";

// Right-side TopBar cluster on /customers. Replaces the generic
// "+ New Sale" shortcut with four customer-management actions:
//
//   • Export — XLSX of the current filtered view (mirrors ?q + dates)
//   • Import — uploads .xlsx, runs /api/customers/import, summary toast
//   • Refresh Stats — re-fetches the page (router.refresh)
//   • + Add Customer — appends `?action=add`; CustomerList watches
//                      the URL and opens the dialog. State lives in
//                      the URL so the cluster doesn't need to know
//                      about CustomerList's React tree.
//
// Each button mirrors the styling of the Bell / Theme / Sign-out
// buttons next to it (h-9 w-9, border/60, bg/80) so the whole right
// cluster reads as one row.
export function CustomersActionsCluster() {
  const router = useRouter();
  const params = useSearchParams();
  const [exporting, startExporting] = useTransition();
  const [refreshing, startRefreshing] = useTransition();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    startExporting(async () => {
      try {
        // Reuse the URL params so the spreadsheet matches what's on
        // screen — same contract the Reports export uses.
        const url = new URL(
          "/api/customers/export",
          window.location.origin
        );
        params.forEach((value, key) => url.searchParams.set(key, value));
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Defer revoke so Safari/Chrome resolve the URL before we
        // pull the rug.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        toast.success("Customers exported");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed");
      }
    });
  }

  function triggerImport() {
    fileRef.current?.click();
  }

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/customers/import", {
        method: "POST",
        body: fd,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Import failed (${res.status})`);
      const { created = 0, skipped = 0, errors = [] } = payload as {
        created?: number;
        skipped?: number;
        errors?: { row: number; message: string }[];
      };
      const errorCount = errors.length;
      const summary = [
        `${created} created`,
        skipped > 0 ? `${skipped} skipped` : null,
        errorCount > 0 ? `${errorCount} failed` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      if (errorCount > 0) {
        toast.warning(`Import complete with errors — ${summary}`, {
          description: errors
            .slice(0, 3)
            .map((e) => `Row ${e.row}: ${e.message}`)
            .join("\n"),
        });
      } else {
        toast.success(`Import complete — ${summary}`);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleRefresh() {
    startRefreshing(() => {
      router.refresh();
      // Surface a short confirmation so the user knows the click
      // landed even when the data hasn't visibly changed.
      toast.success("Refreshing customer data…");
    });
  }

  function handleAdd() {
    // Cross-tree signal — the dialog lives in CustomerList (page),
    // we live in the layout. Skipping URL state keeps the address
    // bar clean while the dialog is open. CustomerList listens for
    // this event and opens the dialog locally.
    window.dispatchEvent(new CustomEvent("customers:open-add-dialog"));
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Hidden file picker — opened by the Import button */}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={exporting}
            aria-label="Export customers"
            className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Export</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={triggerImport}
            disabled={importing}
            aria-label="Import customers"
            className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Import</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh customer data"
            className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Refresh Stats</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleAdd}
            aria-label="Add customer"
            className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Add Customer</TooltipContent>
      </Tooltip>
    </div>
  );
}
