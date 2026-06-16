"use client";

// "+" new-leave-type action for the Manage Leave Types page. Renders the trigger
// + dialog into the global TopBar (portal into #topbar-action-slot) so the button
// sits just left of the notification bell, but only while this page is mounted.
// The form lives ONLY here now — it was removed from the page body.

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
import { Textarea } from "@/components/ui/textarea";
import { createLeaveTypeAction } from "../../../actions";

export function NewLeaveTypeDialog() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const slot = document.getElementById("topbar-action-slot");
  if (!slot) return null;

  return createPortal(
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="New leave type"
          title="New leave type"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Leave Type</DialogTitle>
          <DialogDescription>e.g., Annual, Sick, Maternity</DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createLeaveTypeAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required minLength={2} placeholder="Annual Leave" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input id="code" name="code" required maxLength={4} placeholder="AL" className="font-mono uppercase" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="annualEntitlement" className="text-xs">Annual Entitlement (days)</Label>
            <Input id="annualEntitlement" name="annualEntitlement" type="number" min="0" defaultValue="20" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color" className="text-xs">Color</Label>
            <Input id="color" name="color" type="color" defaultValue="#6366f1" className="h-10" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPaid" name="isPaid" defaultChecked className="rounded" />
            <Label htmlFor="isPaid" className="text-xs cursor-pointer">Paid leave</Label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="requiresApproval" name="requiresApproval" defaultChecked className="rounded" />
            <Label htmlFor="requiresApproval" className="text-xs cursor-pointer">Requires approval</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Create Type
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
