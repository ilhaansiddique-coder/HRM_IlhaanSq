"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { addSalaryComponentAction } from "../../../actions-phase2";

// Per-structure "add component" form. Client wrapper so a failed save
// surfaces a clear, retryable toast instead of silently losing the write.
export function AddComponentForm({ structureId }: { structureId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addSalaryComponentAction(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Component added");
        formRef.current?.reset();
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-2 grid-cols-2 pt-3 border-t border-border/60"
    >
      <input type="hidden" name="structureId" value={structureId} />
      <Input
        name="name"
        placeholder="Component name (HRA)"
        required
        minLength={2}
        className="col-span-1"
      />
      <Input
        name="code"
        placeholder="Code (HRA)"
        required
        maxLength={10}
        className="col-span-1 font-mono uppercase"
      />
      <Select name="type" defaultValue="earning">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="earning">Earning</SelectItem>
          <SelectItem value="deduction">Deduction</SelectItem>
        </SelectContent>
      </Select>
      <Select name="calculationType" defaultValue="fixed">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fixed">Fixed amount</SelectItem>
          <SelectItem value="percent_of_basic">% of Basic</SelectItem>
          <SelectItem value="percent_of_gross">% of Gross</SelectItem>
        </SelectContent>
      </Select>
      <Input
        name="value"
        type="number"
        step="0.01"
        placeholder="Value"
        required
        className="col-span-2"
      />
      <Button
        type="submit"
        className="col-span-2"
        size="sm"
        disabled={pending}
      >
        <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add component"}
      </Button>
    </form>
  );
}