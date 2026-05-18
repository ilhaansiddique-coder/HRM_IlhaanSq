"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { updateBreakTimeThresholdAction } from "../../actions";
import { useRouter } from "next/navigation";

export function BreakThresholdForm({
  defaultValue,
}: {
  defaultValue: number;
}) {
  const [minutes, setMinutes] = useState(String(defaultValue));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSave() {
    const val = parseInt(minutes, 10);
    if (isNaN(val) || val < 1) {
      setError("Please enter a valid number of minutes (min 1)");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("breakTimeThreshold", String(val));
        await updateBreakTimeThresholdAction(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Break Time Threshold (minutes)</Label>
        <Input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          disabled={pending}
        />
      </div>
      <Button onClick={handleSave} disabled={pending} size="sm" variant="outline">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
}
