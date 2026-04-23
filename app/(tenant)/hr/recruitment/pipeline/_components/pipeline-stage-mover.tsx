"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveStageAction } from "../../../actions-phase2";

const STAGES = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

export function PipelineStageMover({
  applicationId,
  currentStage,
}: {
  applicationId: string;
  currentStage: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(stage: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", applicationId);
      fd.set("stage", stage);
      try {
        await moveStageAction(fd);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <Select value={currentStage} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="h-7 text-[10px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            Move to {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
