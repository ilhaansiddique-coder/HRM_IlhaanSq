"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast";
import {
  updateDepartmentAction,
  deleteDepartmentAction,
} from "../../actions";

export type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  costCenter: string | null;
  description: string | null;
  employeeCount: number;
};

export function DepartmentRowActions({
  department,
  variant = "icon",
}: {
  department: DepartmentRow;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleEdit(formData: FormData) {
    formData.set("id", department.id);
    startTransition(async () => {
      const res = await updateDepartmentAction(formData);
      if (res.ok) {
        toast.success("Department updated");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to update department");
      }
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", department.id);
    startTransition(async () => {
      const res = await deleteDepartmentAction(fd);
      if (res.ok) {
        toast.success("Department deleted");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to delete department");
        setConfirmOpen(false);
      }
    });
  }

  const isFull = variant === "full";

  return (
    <div className={isFull ? "grid grid-cols-2 gap-2" : "flex items-center justify-end gap-0.5"}>
      {/* Edit */}
      <Button
        type="button"
        variant={isFull ? "outline" : "ghost"}
        size={isFull ? "sm" : "icon"}
        className={isFull ? "rounded-lg" : "h-8 w-8"}
        onClick={() => setEditOpen(true)}
        title="Edit department"
      >
        <Pencil className="h-3.5 w-3.5" />
        {isFull && "Edit"}
      </Button>

      {/* Delete */}
      <Button
        type="button"
        variant={isFull ? "outline" : "ghost"}
        size={isFull ? "sm" : "icon"}
        className={
          isFull
            ? "rounded-lg text-destructive hover:text-destructive"
            : "h-8 w-8 text-destructive"
        }
        onClick={() => setConfirmOpen(true)}
        title="Delete department"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isFull && "Delete"}
      </Button>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit department</DialogTitle>
            <DialogDescription>
              Update the details for “{department.name}”.
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${department.id}`} className="text-xs">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`name-${department.id}`}
                name="name"
                required
                minLength={2}
                defaultValue={department.name}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`code-${department.id}`} className="text-xs">
                Code
              </Label>
              <Input
                id={`code-${department.id}`}
                name="code"
                defaultValue={department.code ?? ""}
                placeholder="SALES"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`cc-${department.id}`} className="text-xs">
                Cost Center
              </Label>
              <Input
                id={`cc-${department.id}`}
                name="costCenter"
                defaultValue={department.costCenter ?? ""}
                placeholder="CC-1001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`desc-${department.id}`} className="text-xs">
                Description
              </Label>
              <Textarea
                id={`desc-${department.id}`}
                name="description"
                rows={2}
                defaultValue={department.description ?? ""}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{department.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {department.employeeCount > 0
                ? `This department has ${department.employeeCount} employee${
                    department.employeeCount === 1 ? "" : "s"
                  }. You must reassign them before it can be deleted.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
