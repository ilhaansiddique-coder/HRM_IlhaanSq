"use client";

// "+" new-position action for the Positions page. Renders the trigger + dialog
// into the global TopBar (portal into #topbar-action-slot) so the button sits
// just left of the notification bell, but only while this page is mounted. The
// form lives ONLY here now — it was removed from the page body.

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
import { createPositionAction } from "../../actions";

export function NewPositionDialog({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
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
          aria-label="New position"
          title="New position"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Position</DialogTitle>
          <DialogDescription>Add a job title</DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createPositionAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="title" name="title" required minLength={2} placeholder="Sales Manager" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="departmentId" className="text-xs">Department</Label>
            <Select name="departmentId">
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {departments.length === 0 ? (
                  <SelectItem value="_none" disabled>No departments</SelectItem>
                ) : (
                  departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade" className="text-xs">Salary Grade</Label>
            <Input id="grade" name="grade" placeholder="e.g. L4" />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Add Position
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
