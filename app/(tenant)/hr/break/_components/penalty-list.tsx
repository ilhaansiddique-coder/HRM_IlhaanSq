"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { applyBreakPenaltyAction, waiveBreakPenaltyAction, deleteBreakPenaltyAction } from "../../actions";
import { Check, X, Trash2, Loader2 } from "lucide-react";

interface Penalty {
  id: string;
  employee: { id: string; fullName: string; empCode: string };
  amount: number;
  reason: string;
  status: string;
  exceededMinutes: number;
  breakSession?: { breakStart: string; breakEnd: string | null; durationMin: number };
  appliedAt: string | null;
  createdAt: string;
}

export function PenaltyList({
  penalties,
  isAdmin,
}: {
  penalties: Penalty[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  function handleAction(
    penaltyId: string,
    action: typeof applyBreakPenaltyAction | typeof waiveBreakPenaltyAction | typeof deleteBreakPenaltyAction
  ) {
    setActionId(penaltyId);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("penaltyId", penaltyId);
        await action(fd);
      } catch (_) {
        /* handled by revalidation */
      } finally {
        setActionId(null);
      }
    });
  }

  if (penalties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No penalties recorded</p>
      </div>
    );
  }

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    applied: "destructive",
    waived: "outline",
  };

  return (
    <div className="space-y-2">
      {penalties.map((p) => (
        <div
          key={p.id}
          className="rounded-lg border border-border/60 bg-background/40 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{p.employee.fullName}</p>
                <Badge variant="outline" className="text-[10px]">
                  {p.employee.empCode}
                </Badge>
                <Badge variant={statusColors[p.status]} className="text-[10px]">
                  {p.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Amount: <span className="font-semibold text-destructive">BDT {Number(p.amount).toLocaleString()}</span>
                {p.exceededMinutes > 0 && ` · Exceeded by ${p.exceededMinutes} min`}
              </p>
              {p.breakSession && (
                <p className="text-[11px] text-muted-foreground">
                  Break: {new Date(p.breakSession.breakStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {p.breakSession.breakEnd &&
                    ` → ${new Date(p.breakSession.breakEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  {" "}({p.breakSession.durationMin} min)
                </p>
              )}
              <p className="text-xs italic text-muted-foreground mt-1">
                &ldquo;{p.reason}&rdquo;
              </p>
              {p.appliedAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Applied on {new Date(p.appliedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {isAdmin && p.status === "pending" && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full"
                  onClick={() => handleAction(p.id, applyBreakPenaltyAction)}
                  disabled={pending}
                  title="Apply Penalty"
                >
                  {actionId === p.id && pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-success" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full"
                  onClick={() => handleAction(p.id, waiveBreakPenaltyAction)}
                  disabled={pending}
                  title="Waive Penalty"
                >
                  <X className="h-3.5 w-3.5 text-warning" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full"
                  onClick={() => handleAction(p.id, deleteBreakPenaltyAction)}
                  disabled={pending}
                  title="Delete Penalty"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
