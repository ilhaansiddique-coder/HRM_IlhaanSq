"use client";

// "+" enroll action for the Enrollments page. Renders the trigger + dialog into
// the global TopBar (portal into #topbar-action-slot) so the button sits just
// left of the notification bell, but only while this page is mounted. The
// enroll form lives ONLY here now — it was removed from the page body.

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enrollAction } from "../../../actions-phase2";

type CourseOption = { id: string; title: string };
type EmployeeOption = { id: string; fullName: string; empCode: string };

export function EnrollEmployeeDialog({
  courses,
  employees,
}: {
  courses: CourseOption[];
  employees: EmployeeOption[];
}) {
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
          aria-label="Enroll employee"
          title="Enroll employee"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll Employee</DialogTitle>
          <DialogDescription>
            Assign an employee to a published course.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await enrollAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Course *</Label>
            <Select name="courseId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select course..." />
              </SelectTrigger>
              <SelectContent>
                {courses.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No published courses
                  </SelectItem>
                ) : (
                  courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Employee *</Label>
            <Select name="employeeId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName} ({e.empCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Enroll
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            A certificate is auto-issued on 100% progress.
          </p>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
