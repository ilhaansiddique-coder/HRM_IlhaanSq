"use client";

// "+" add-candidate action for the Candidates page. Renders the trigger + dialog
// into the global TopBar (portal into #topbar-action-slot) so the button sits
// just left of the notification bell, but only while this page is mounted. The
// add-candidate form lives ONLY here now — it was removed from the page body.

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
import { createCandidateAction } from "../../../actions-phase2";

export function AddCandidateDialog() {
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
          aria-label="Add candidate"
          title="Add candidate"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>Add a candidate to the talent pool.</DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createCandidateAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs">
              Full name *
            </Label>
            <Input id="fullName" name="fullName" required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email *
            </Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">
              Phone
            </Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentRole" className="text-xs">
              Current role
            </Label>
            <Input id="currentRole" name="currentRole" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentCompany" className="text-xs">
              Current company
            </Label>
            <Input id="currentCompany" name="currentCompany" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedinUrl" className="text-xs">
              LinkedIn URL
            </Label>
            <Input id="linkedinUrl" name="linkedinUrl" type="url" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source" className="text-xs">
              Source
            </Label>
            <Select name="source" defaultValue="direct">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="job_board">Job Board</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
