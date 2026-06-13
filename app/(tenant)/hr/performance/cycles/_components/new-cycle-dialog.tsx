"use client";

// "+" new-cycle action for the Cycles page. Renders the trigger + dialog into
// the global TopBar (portal into #topbar-action-slot) so the button sits just
// left of the notification bell, but only while this page is mounted. The
// new-cycle form lives ONLY here now — it was removed from the page body.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCycleAction } from "../../../actions-phase2";

export function NewCycleDialog() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Portal target lives in the (client) TopBar; only available after mount.
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const slot = document.getElementById("topbar-action-slot");
  if (!slot) return null;

  return createPortal(
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="New cycle"
          title="New cycle"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Cycle</DialogTitle>
          <DialogDescription>Create a performance review cycle.</DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createCycleAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Name *
            </Label>
            <Input id="name" name="name" required minLength={2} placeholder="2026 Annual Review" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type" className="text-xs">
              Type
            </Label>
            <Select name="type" defaultValue="annual">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs">
                From
              </Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-xs">
                To
              </Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
