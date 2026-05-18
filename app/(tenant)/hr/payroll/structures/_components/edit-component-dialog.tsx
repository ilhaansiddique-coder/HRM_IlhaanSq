"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { updateSalaryComponentAction } from "../../../actions-phase2";

export type ComponentRow = {
  id: string;
  name: string;
  code: string;
  type: "earning" | "deduction" | "reimbursement";
  calculationType: "fixed" | "percent_of_basic" | "percent_of_gross";
  value: number;
};

// Edit one structure rule. Earnings must use one of the 5 allowance codes
// and can't be % of gross — the server enforces this and any violation
// surfaces as a toast. Mirrors the edit-structure-dialog convention.
export function EditComponentDialog({ row }: { row: ComponentRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: row.name,
    code: row.code,
    type: row.type,
    calculationType: row.calculationType,
    value: String(row.value),
  });

  function onOpenChange(next: boolean) {
    if (next)
      setForm({
        name: row.name,
        code: row.code,
        type: row.type,
        calculationType: row.calculationType,
        value: String(row.value),
      });
    setOpen(next);
  }

  function onSave() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("name", form.name.trim());
    fd.set("code", form.code.trim().toUpperCase());
    fd.set("type", form.type);
    fd.set("calculationType", form.calculationType);
    fd.set("value", form.value === "" ? "0" : form.value);
    startTransition(async () => {
      const result = await updateSalaryComponentAction(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Component updated");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Edit rule"
        onClick={() => onOpenChange(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit rule</DialogTitle>
          <DialogDescription>
            Earning rules must use a standard allowance code and apply to
            future payroll runs only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code</Label>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    type: v as ComponentRow["type"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Calculation</Label>
              <Select
                value={form.calculationType}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    calculationType: v as ComponentRow["calculationType"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percent_of_basic">% of Basic</SelectItem>
                  <SelectItem value="percent_of_gross">
                    % of Gross (deductions only)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {form.calculationType === "fixed"
                ? "Amount"
                : "Percentage (%)"}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) =>
                setForm((p) => ({ ...p, value: e.target.value }))
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