"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { updateLateThresholdAction } from "../../actions";

export function LateThresholdForm({
  tenantId,
  defaultValue,
}: {
  tenantId: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      fd.set("lateThreshold", value || "");
      await updateLateThresholdAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle>Late Check-In Threshold</CardTitle>
        <CardDescription>
          Check-ins after this time will be marked as &ldquo;late.&rdquo;
          Leave empty to disable late tracking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Threshold Time</Label>
            <TimePicker
              value={value}
              onChange={setValue}
              placeholder="Set threshold"
              className="w-44"
            />
          </div>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
