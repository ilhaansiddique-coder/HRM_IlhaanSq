"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { updateSalaryStructureAction } from "../../../actions-phase2";

// View + edit an already-created structure's own fields (name, description,
// active). Components are managed separately on the card. Fields are
// controlled so the Switch value reliably reaches the server action (built
// into FormData by hand). Mirrors the codebase dialog convention
// (see customer-dialog.tsx): controlled open, useTransition, toast result.
export function EditStructureDialog({
  id,
  name,
  description,
  isActive,
}: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name,
    description: description ?? "",
    isActive,
  });

  // Reset the form to the latest props whenever the dialog (re)opens, so a
  // cancelled edit doesn't leak into the next open.
  function onOpenChange(next: boolean) {
    if (next) setForm({ name, description: description ?? "", isActive });
    setOpen(next);
  }

  function onSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", form.name.trim());
    fd.set("description", form.description);
    fd.set("isActive", String(form.isActive));
    startTransition(async () => {
      const result = await updateSalaryStructureAction(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Salary structure updated");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => onOpenChange(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit salary structure</DialogTitle>
          <DialogDescription>
            Update the structure&apos;s name, description, or active state. To
            change pay components, use the list on the card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${id}`} className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`name-${id}`}
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              minLength={2}
              placeholder="Standard Staff"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`desc-${id}`} className="text-xs">
              Description
            </Label>
            <Textarea
              id={`desc-${id}`}
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive structures stay listed but are excluded from the
                active-structure count.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) =>
                setForm((p) => ({ ...p, isActive: v }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}