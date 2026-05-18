"use client";

import { useTransition } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { createStandardStructureAction } from "../../../actions-phase2";

// Idempotent — ensureStandardSalaryStructure won't duplicate. We still
// toast the outcome so a cold-start failure is visible and retryable
// rather than appearing to do nothing.
export function StandardStructureButton() {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await createStandardStructureAction();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Standard salary structure ready");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={onClick}
    >
      <Layers className="h-4 w-4" />
      {pending ? "Working…" : "Create standard salary structure"}
    </Button>
  );
}