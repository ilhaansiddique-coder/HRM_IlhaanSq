"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SquarePen, Trash2, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { updatePositionAction, deletePositionAction } from "../../actions";

export type PositionRow = {
  id: string;
  title: string;
  departmentId: string | null;
  grade: string | null;
  band: string | null;
  jobFamily: string | null;
  isManager: boolean;
  description: string | null;
  employeeCount: number;
};

const NO_DEPT = "_none";

export function PositionRowActions({
  position,
  departments,
  variant = "icon",
}: {
  position: PositionRow;
  departments: { id: string; name: string }[];
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deptId, setDeptId] = useState<string>(
    position.departmentId ?? NO_DEPT
  );
  const [pending, startTransition] = useTransition();

  function handleEdit(formData: FormData) {
    formData.set("id", position.id);
    formData.set("departmentId", deptId === NO_DEPT ? "" : deptId);
    startTransition(async () => {
      const res = await updatePositionAction(formData);
      if (res.ok) {
        toast.success("Position updated");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to update position");
      }
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", position.id);
    startTransition(async () => {
      const res = await deletePositionAction(fd);
      if (res.ok) {
        toast.success("Position deleted");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to delete position");
        setConfirmOpen(false);
      }
    });
  }

  const isFull = variant === "full";

  return (
    <div
      className={
        isFull
          ? "grid grid-cols-2 gap-2"
          : "flex items-center justify-end gap-0.5"
      }
    >
      <Button
        type="button"
        variant={isFull ? "outline" : "ghost"}
        size={isFull ? "sm" : "icon"}
        className={isFull ? "rounded-lg" : "h-8 w-8 rounded-full"}
        onClick={() => setEditOpen(true)}
        title="Edit position"
      >
        <SquarePen className="h-3.5 w-3.5" />
        {isFull && "Edit"}
      </Button>

      <Button
        type="button"
        variant={isFull ? "outline" : "ghost"}
        size={isFull ? "sm" : "icon"}
        className={
          isFull
            ? "rounded-lg text-destructive hover:text-destructive"
            : "h-8 w-8 rounded-full text-destructive"
        }
        onClick={() => setConfirmOpen(true)}
        title="Delete position"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isFull && "Delete"}
      </Button>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit position</DialogTitle>
            <DialogDescription>
              Update the details for “{position.title}”.
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`title-${position.id}`} className="text-xs">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`title-${position.id}`}
                name="title"
                required
                minLength={2}
                defaultValue={position.title}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPT}>No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`grade-${position.id}`} className="text-xs">
                Salary Grade
              </Label>
              <Input
                id={`grade-${position.id}`}
                name="grade"
                defaultValue={position.grade ?? ""}
                placeholder="e.g. L4"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`desc-${position.id}`} className="text-xs">
                Description
              </Label>
              <Textarea
                id={`desc-${position.id}`}
                name="description"
                rows={2}
                defaultValue={position.description ?? ""}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id={`mgr-${position.id}`}
                name="isManager"
                defaultChecked={position.isManager}
                className="rounded"
              />
              <Label
                htmlFor={`mgr-${position.id}`}
                className="cursor-pointer text-xs"
              >
                This is a manager role
              </Label>
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
            <AlertDialogTitle>Delete “{position.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {position.employeeCount > 0
                ? `This position has ${position.employeeCount} holder${
                    position.employeeCount === 1 ? "" : "s"
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
