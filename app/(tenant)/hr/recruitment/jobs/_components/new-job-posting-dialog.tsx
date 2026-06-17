"use client";

// "+" new-job-posting action. Renders the trigger + dialog into the global
// TopBar (portal into #topbar-action-slot) so the button sits just left of the
// notification bell, but only while the host page is mounted. Used on both the
// Recruitment overview and the Jobs page; the inline form was removed from Jobs.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Briefcase } from "lucide-react";
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
import { createJobAction } from "../../../actions-phase2";

export function NewJobPostingDialog() {
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
          aria-label="New job posting"
          title="New job posting"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="!h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            New Job Posting
          </DialogTitle>
          <DialogDescription>
            Create a job posting. Choosing Open immediately raises an admin
            approval before it goes live.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createJobAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title *
            </Label>
            <Input id="title" name="title" required minLength={2} placeholder="Senior Sales Manager" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs">
              Location
            </Label>
            <Input id="location" name="location" placeholder="Dhaka / Remote" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employmentType" className="text-xs">
              Type
            </Label>
            <Select name="employmentType" defaultValue="full_time">
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
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="salaryMin" className="text-xs">
                Min Salary
              </Label>
              <Input id="salaryMin" name="salaryMin" type="number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryMax" className="text-xs">
                Max Salary
              </Label>
              <Input id="salaryMax" name="salaryMax" type="number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs">
                Status
              </Label>
              <Select name="status" defaultValue="draft">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description *
            </Label>
            <Textarea id="description" name="description" rows={3} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requirements" className="text-xs">
              Requirements
            </Label>
            <Textarea id="requirements" name="requirements" rows={2} />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Create Posting
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
