"use client";

// "+" new-course action for the Courses page. Renders the trigger + dialog into
// the global TopBar (portal into #topbar-action-slot) so the button sits just
// left of the notification bell, but only while this page is mounted. The
// new-course form lives ONLY here now — it was removed from the page body.

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCourseAction } from "../../../actions-phase2";

export function NewCourseDialog() {
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
          aria-label="New course"
          title="New course"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Course</DialogTitle>
          <DialogDescription>
            Create a learning course for employees.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createCourseAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title *
            </Label>
            <Input id="title" name="title" required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-xs">
              Category
            </Label>
            <Input id="category" name="category" placeholder="Sales, Compliance, IT" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level" className="text-xs">
              Level
            </Label>
            <Select name="level" defaultValue="beginner">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="durationHours" className="text-xs">
                Duration (hrs)
              </Label>
              <Input id="durationHours" name="durationHours" type="number" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instructorName" className="text-xs">
                Instructor
              </Label>
              <Input id="instructorName" name="instructorName" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublished"
              name="isPublished"
              className="rounded"
            />
            <Label htmlFor="isPublished" className="text-xs cursor-pointer">
              Publish immediately
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
