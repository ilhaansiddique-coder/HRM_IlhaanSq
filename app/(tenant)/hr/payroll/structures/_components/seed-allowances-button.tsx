"use client";

import { useTransition } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { seedStandardAllowanceRowsAction } from "../../../actions-phase2";

// Creates any missing standard allowance rules (House Rent, Health,
// Education, Savings, Daily Hand) as "% of basic = 0" so they're editable
// in the table without changing pay until a value is set. Idempotent.
export function SeedAllowancesButton({ structureId }: { structureId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("structureId", structureId);
    startTransition(async () => {
      const result = await seedStandardAllowanceRowsAction(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Standard allowance rules added (set their values)");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={onClick}
    >
      <ListPlus className="h-4 w-4" />
      {pending ? "Adding…" : "Add standard allowance rules"}
    </Button>
  );
}