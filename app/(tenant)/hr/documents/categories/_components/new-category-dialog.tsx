"use client";

// "+" new-category action for the Categories page. Renders the trigger + dialog
// into the global TopBar (portal into #topbar-action-slot) so the button sits
// just left of the notification bell, but only while this page is mounted.
// The new-category form lives ONLY here now — it was removed from the page body.

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
import { createDocCategoryAction } from "../../../actions-phase2";

export function NewCategoryDialog() {
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
          aria-label="New employee contract"
          title="New employee contract"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Employee Contract</DialogTitle>
          <DialogDescription>
            Create a category to organise employee documents.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createDocCategoryAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Name *
            </Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              placeholder="Employment Contracts"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="retentionDays" className="text-xs">
              Retention (days)
            </Label>
            <Input
              id="retentionDays"
              name="retentionDays"
              type="number"
              min="0"
              placeholder="2555"
            />
            <p className="text-[10px] text-muted-foreground">
              Optional. e.g. 2555 = 7 years
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequired"
              name="isRequired"
              className="rounded"
            />
            <Label htmlFor="isRequired" className="text-xs cursor-pointer">
              Required for all employees
            </Label>
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
