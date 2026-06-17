"use client";

// "+" upload action for the Documents page. It renders the trigger + dialog
// into the global TopBar (via a portal into #topbar-action-slot) so the button
// sits just left of the notification bell, but only while this page is mounted.
// The upload form lives ONLY here now — it was removed from the page body.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, FileText } from "lucide-react";
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
import { createDocumentAction } from "../../actions-phase2";
import { DocumentUploadField } from "./document-upload-field";

type EmployeeOption = { id: string; fullName: string };
type CategoryOption = { id: string; name: string };

export function UploadDocumentDialog({
  employees,
  categories,
}: {
  employees: EmployeeOption[];
  categories: CategoryOption[];
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
          aria-label="Upload document"
          title="Upload document"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Upload Document
          </DialogTitle>
          {/* <DialogDescription>
            Attach a document to an employee record.
          </DialogDescription> */}
        </DialogHeader>
        <form
          action={async (formData) => {
            await createDocumentAction(formData);
            setOpen(false);
          }}
          className="flex flex-1 flex-col space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Employee *</Label>
              <Select name="employeeId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select name="categoryId">
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No categories
                    </SelectItem>
                  ) : (
                    categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Document name *
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Employment Contract"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Document file</Label>
            <DocumentUploadField name="fileUrl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiresAt" className="text-xs">
              Expiry date
            </Label>
            <Input id="expiresAt" name="expiresAt" type="date" />
          </div>
          <div className="flex flex-1 flex-col space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              className="!h-full flex-1 resize-none"
            />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Upload
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
