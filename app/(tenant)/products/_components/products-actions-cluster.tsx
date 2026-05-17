"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import {
  createProductAction,
  exportProductsCsvAction,
} from "../actions";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { ProductDialog } from "./product-dialog";

// Replaces the generic Sales / Reports / Customers TopBar shortcuts when
// the user is on /products. Provides three product-management actions:
//   - Import:   parse a CSV file client-side, call createProductAction
//               for each row, show a summary toast.
//   - Export:   call the exportProductsCsvAction server action, wrap the
//               returned CSV in a Blob, trigger download.
//   - Adjust:   open the AdjustStockDialog (product picker + quantity).
export function ProductsActionsCluster() {
  const router = useRouter();
  const [exporting, startExport] = useTransition();
  const [importing, setImporting] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    startExport(async () => {
      try {
        const { csv } = await exportProductsCsvAction();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Products exported");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to export");
      }
    });
  }

  function triggerImport() {
    fileRef.current?.click();
  }

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("CSV is empty");
        return;
      }
      const header = rows[0].map((h) => h.toLowerCase().trim());
      const data = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
      const required = ["name", "rate"];
      for (const req of required) {
        if (!header.includes(req)) {
          toast.error(`CSV is missing required column: ${req}`);
          return;
        }
      }
      const idx = (col: string) => header.indexOf(col);

      let ok = 0;
      let failed = 0;
      for (const row of data) {
        const fd = new window.FormData();
        const name = row[idx("name")]?.trim();
        const rate = row[idx("rate")]?.trim();
        if (!name || !rate) {
          failed += 1;
          continue;
        }
        fd.set("name", name);
        fd.set("rate", rate);
        // categoryLabel is required by the action; default to UNCATEGORISED
        // so existing imports succeed even if the CSV omits a category.
        fd.set("categoryLabel", "Uncategorised");
        fd.set("categoryCode", "UNCAT");
        fd.set("categoryIsNew", "1");
        if (idx("sku") >= 0) fd.set("sku", row[idx("sku")] ?? "");
        if (idx("cost") >= 0) fd.set("cost", row[idx("cost")] ?? "");
        if (idx("stock_quantity") >= 0)
          fd.set("stockQuantity", row[idx("stock_quantity")] ?? "0");
        if (idx("size") >= 0) fd.set("size", row[idx("size")] ?? "");
        if (idx("color") >= 0) fd.set("color", row[idx("color")] ?? "");
        if (idx("image_url") >= 0)
          fd.set("imageUrl", row[idx("image_url")] ?? "");
        try {
          await createProductAction(fd);
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      toast.success(
        `Imported ${ok} product${ok !== 1 ? "s" : ""}${
          failed > 0 ? ` · ${failed} skipped` : ""
        }`
      );
      router.refresh();
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <ClusterIconButton
        label="Import"
        disabled={importing}
        onClick={triggerImport}
      >
        <Upload className="h-4 w-4" />
      </ClusterIconButton>
      <ClusterIconButton
        label="Export"
        disabled={exporting}
        onClick={handleExport}
      >
        <Download className="h-4 w-4" />
      </ClusterIconButton>
      <ClusterIconButton
        label="Adjust Stock"
        onClick={() => setAdjustOpen(true)}
      >
        <ArchiveRestore className="h-4 w-4" />
      </ClusterIconButton>
      {/* Add Product — opens the same ProductDialog the per-row Edit
          uses, but with no `initial` so it boots in create mode (with
          variants tab + image dropzone + category combobox). The dialog
          calls router.refresh() on submit so the page repopulates with
          the new product without a manual reload. */}
      <ClusterIconButton
        label="Add Product"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </ClusterIconButton>

      <AdjustStockDialog open={adjustOpen} onOpenChange={setAdjustOpen} />
      <ProductDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function ClusterIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="h-9 w-9 rounded-lg border-border/60 bg-background/80"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

// Minimal CSV parser — handles quoted cells with embedded commas/newlines/
// escaped quotes. Returns an array of rows (each row is array of cells).
// Good enough for reasonably-sized product imports without bringing in
// papaparse as a dependency.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += c;
      }
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
