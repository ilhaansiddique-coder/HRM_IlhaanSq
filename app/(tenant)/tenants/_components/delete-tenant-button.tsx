"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTenantAction } from "../actions";

type Props = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  counts: {
    members: number;
    products: number;
    sales: number;
    customers: number;
  };
};

export function DeleteTenantButton({
  tenantId,
  tenantName,
  tenantSlug,
  counts,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirmText.trim() === tenantSlug;

  function handleDelete() {
    if (!canDelete) return;
    setError(null);
    const fd = new FormData();
    fd.set("tenantId", tenantId);
    startTransition(async () => {
      try {
        await deleteTenantAction(fd);
        setOpen(false);
        setConfirmText("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${tenantName}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          if (!o) {
            setConfirmText("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tenant</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium">{tenantName}</span> and every
              product, sale, customer, and HR record it owns. It cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium">{counts.members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Products</span>
                <span className="font-medium">{counts.products}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sales</span>
                <span className="font-medium">{counts.sales}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customers</span>
                <span className="font-medium">{counts.customers}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-slug">
                Type{" "}
                <span className="font-mono font-semibold">{tenantSlug}</span>{" "}
                to confirm
              </Label>
              <Input
                id="confirm-slug"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={tenantSlug}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
