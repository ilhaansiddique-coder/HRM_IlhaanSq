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
import { updateJobAction, deleteJobAction } from "../../../actions-phase2";

export type JobRow = {
  id: string;
  title: string;
  location: string | null;
  employmentType: string;
  salaryMin: string | null;
  salaryMax: string | null;
  description: string;
  requirements: string | null;
};

export function JobRowActions({ job }: { job: JobRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [empType, setEmpType] = useState(job.employmentType || "full_time");
  const [pending, startTransition] = useTransition();

  function handleEdit(formData: FormData) {
    formData.set("id", job.id);
    formData.set("employmentType", empType);
    startTransition(async () => {
      const res = await updateJobAction(formData);
      if (res.ok) {
        toast.success("Edit submitted for admin approval");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to submit edit");
      }
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", job.id);
    startTransition(async () => {
      const res = await deleteJobAction(fd);
      if (res.ok) {
        toast.success("Delete submitted for admin approval");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to submit delete");
        setConfirmOpen(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => setEditOpen(true)}
        title="Edit job posting (needs admin approval)"
      >
        <SquarePen className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-destructive"
        onClick={() => setConfirmOpen(true)}
        title="Delete job posting (needs admin approval)"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit job posting</DialogTitle>
            <DialogDescription>
              Submitting unlists the job and sends the changes for admin
              approval. It is re-listed once approved.
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`t-${job.id}`} className="text-xs">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`t-${job.id}`}
                name="title"
                required
                minLength={2}
                defaultValue={job.title}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`loc-${job.id}`} className="text-xs">
                Location
              </Label>
              <Input
                id={`loc-${job.id}`}
                name="location"
                defaultValue={job.location ?? ""}
                placeholder="Dhaka / Remote"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={empType} onValueChange={setEmpType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor={`smin-${job.id}`} className="text-xs">
                  Min Salary
                </Label>
                <Input
                  id={`smin-${job.id}`}
                  name="salaryMin"
                  type="number"
                  defaultValue={job.salaryMin ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`smax-${job.id}`} className="text-xs">
                  Max Salary
                </Label>
                <Input
                  id={`smax-${job.id}`}
                  name="salaryMax"
                  type="number"
                  defaultValue={job.salaryMax ?? ""}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`d-${job.id}`} className="text-xs">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id={`d-${job.id}`}
                name="description"
                rows={3}
                required
                defaultValue={job.description}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`r-${job.id}`} className="text-xs">
                Requirements
              </Label>
              <Textarea
                id={`r-${job.id}`}
                name="requirements"
                rows={2}
                defaultValue={job.requirements ?? ""}
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
                Submit for approval
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{job.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This raises a delete approval. The job stays until an owner/admin
              approves the deletion in /admin. Applications are removed with it.
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
              Submit delete for approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
