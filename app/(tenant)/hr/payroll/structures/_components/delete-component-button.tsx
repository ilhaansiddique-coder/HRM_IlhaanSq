"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { deleteSalaryComponentAction } from "../../../actions-phase2";

// Client wrapper so a failed delete (e.g. Neon cold start) is visible and
// retryable instead of appearing to do nothing.
export function DeleteComponentButton({ componentId }: { componentId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("id", componentId);
    startTransition(async () => {
      const result = await deleteSalaryComponentAction(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Component removed");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-destructive"
      disabled={pending}
      onClick={onClick}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}