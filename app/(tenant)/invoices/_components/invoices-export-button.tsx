"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Upload, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Slotted into the TopBar's right cluster (after the notification bell)
// when on /invoices. Popover with two export formats:
//   • CSV — single file, opens in Excel / Sheets / Numbers
//   • PDF — single file, tabular layout, generated client-side via
//          jspdf + jspdf-autotable from the same JSON the CSV route
//          uses internally
//
// Both options re-use the current URL filter params (q, range,
// from/to) so the export always mirrors what's on screen.

type ExportRow = {
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentTerms: string;
  /** Empty string for tenant users, set on super-admin exports. */
  tenantName: string;
};

export function InvoicesExportButton() {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterQs = params.toString();

  // CSV path — native browser download via <a download>. The route
  // sets Content-Disposition so the file lands in the user's downloads
  // folder without any JS overhead.
  const csvHref = `/api/invoices/export${filterQs ? `?${filterQs}` : ""}`;

  async function handleExportPdf() {
    setError(null);
    setPdfLoading(true);
    try {
      // 1. Fetch the filtered rows from the same route, JSON variant.
      const url = new URL("/api/invoices/export", window.location.origin);
      params.forEach((value, key) => url.searchParams.set(key, value));
      url.searchParams.set("format", "json");

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load invoice data (${res.status})`);
      const payload = (await res.json()) as {
        rows: ExportRow[];
        isSuperAdmin?: boolean;
      };
      // No empty-set guard here — CSV export silently produces a
      // header-only file when the filter matches nothing, so PDF
      // should match that behavior. autoTable handles a 0-row body
      // fine (just renders the header row).
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      const showTenant = !!payload.isSuperAdmin;

      // 2. Lazy-import jspdf so it's not in the main bundle.
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable =
        (autoTableMod as { default?: unknown; autoTable?: unknown }).default ??
        (autoTableMod as { autoTable?: unknown }).autoTable;
      if (typeof autoTable !== "function") {
        throw new Error("PDF table plugin failed to load");
      }

      // 3. Build the PDF.
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const generatedAt = new Date().toLocaleString();

      doc.setFontSize(14);
      doc.text("Invoices Export", 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(
        `Generated ${generatedAt} · ${rows.length} row${rows.length === 1 ? "" : "s"}`,
        40,
        56
      );
      doc.setTextColor(0);

      // jspdf-autotable typings vary by version, so cast loosely.
      (autoTable as (doc: unknown, opts: unknown) => void)(doc, {
        startY: 72,
        head: [
          [
            ...(showTenant ? ["Tenant"] : []),
            "Invoice #",
            "Date",
            "Customer",
            "Phone",
            "Total",
            "Paid",
            "Due",
            "Status",
            "Method",
            "Terms",
          ],
        ],
        body: rows.map((r) => [
          ...(showTenant ? [r.tenantName ?? ""] : []),
          r.invoiceNumber,
          new Date(r.createdAt).toLocaleDateString(),
          r.customerName,
          r.customerPhone,
          r.grandTotal.toFixed(2),
          r.amountPaid.toFixed(2),
          r.amountDue.toFixed(2),
          r.paymentStatus,
          r.paymentMethod,
          r.paymentTerms,
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [60, 70, 90], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 40, right: 40 },
      });

      const datePart = new Date().toISOString().slice(0, 10);
      doc.save(`invoices-${datePart}.pdf`);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                // Match the bell + plus + theme + user pill borders
                // (border-border/60 + bg-background/80). Default
                // variant="outline" uses border-input which is a
                // slightly different theme color, making this button
                // look misaligned vs. the rest of the right cluster.
                className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
                aria-label="Export invoices"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Export current view</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-56 p-1">
        <a
          href={csvHref}
          download
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-left">
            <p className="font-medium leading-tight">Export as CSV</p>
            <p className="text-[11px] text-muted-foreground">
              Spreadsheet-friendly
            </p>
          </div>
        </a>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={pdfLoading}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex-1 text-left">
            <p className="font-medium leading-tight">Export as PDF</p>
            <p className="text-[11px] text-muted-foreground">
              {pdfLoading ? "Building…" : "Single-file table"}
            </p>
          </div>
        </button>
        {error && (
          <p className="mt-1 px-3 py-1.5 text-[11px] text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
