"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { createSalaryStructureAction } from "../../../actions-phase2";

// Client wrapper so a failed save (e.g. Neon cold-start P1001) surfaces a
// clear, retryable toast instead of the write silently vanishing. Matches
// the codebase convention (see profile-form.tsx): call the server action in
// a transition, then toast `result`.
export function NewStructureForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createSalaryStructureAction(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Salary structure created");
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          placeholder="Standard Staff"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs">
          Description
        </Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Creating…" : "Create salary structure"}
      </Button>
    </form>
  );
}