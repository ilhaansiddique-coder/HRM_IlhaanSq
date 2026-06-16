"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SalarySheet,
  type Slip,
  type CustomCol,
  type BaseLabelMap,
} from "./salary-sheet";

// "i" button beside Add Column. Opens the SAME editable SalarySheet in a
// near-fullscreen dialog so the whole sheet is visible without the cramped
// left/right scroll of the card. Edits inside work exactly like the inline
// view (same component + server actions; router.refresh keeps it in sync).
export function SalarySheetFullView({
  title,
  slips,
  canEdit,
  customColumns,
  baseLabels,
}: {
  title: string;
  slips: Slip[];
  canEdit: boolean;
  customColumns: CustomCol[];
  baseLabels?: BaseLabelMap;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-full p-0"
          title="Open full-screen view"
          aria-label="Open full-screen salary sheet"
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[94vh] w-[98vw] max-w-[98vw] flex-col gap-3 overflow-hidden p-4 sm:max-w-[98vw]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title} — Full View</DialogTitle>
          <DialogDescription>
            {canEdit
              ? "Editable — click the pencil on a row, just like the normal view."
              : "Read-only — only owners/admins can edit."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/60">
          <div className="p-3">
            <SalarySheet
              slips={slips}
              canEdit={canEdit}
              customColumns={customColumns}
              baseLabels={baseLabels}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
