"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, SquarePen } from "lucide-react";
import { updateAdvanceAction } from "../../../actions-phase2";

// Lets an admin correct an ACTIVE advance's amount / monthly recovery — the
// fix for "installment = 1 so the Advance column barely moves". Saving
// reconciles pending runs server-side and (via websocket) live-refreshes any
// open salary sheet.
export function EditAdvanceDialog({
  advance,
}: {
  advance: { id: string; amount: number; installment: number; reason: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(advance.amount));
  const [installment, setInstallment] = useState(String(advance.installment));
  const [reason, setReason] = useState(advance.reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("id", advance.id);
    fd.set("amount", amount);
    fd.set("installment", installment);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await updateAdvanceAction(fd);
      if (res.ok) {
        setOpen(false);
      } else {
        setError(res.error ?? "Failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          title="Edit advance"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit advance</DialogTitle>
          <DialogDescription>
            Monthly recovery is the amount pulled into each payroll run. A small
            value (e.g. 1) recovers very slowly — set it to a realistic monthly
            figure. Pending runs re-sync automatically on save.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adv-amount" className="text-xs">
              Advance amount
            </Label>
            <Input
              id="adv-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adv-inst" className="text-xs">
              Monthly recovery (installment)
            </Label>
            <Input
              id="adv-inst"
              type="number"
              step="0.01"
              min="0.01"
              value={installment}
              onChange={(e) => setInstallment(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adv-reason" className="text-xs">
              Reason
            </Label>
            <Input
              id="adv-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
