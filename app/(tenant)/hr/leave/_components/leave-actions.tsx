"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveLeaveAction, rejectLeaveAction } from "../../actions";

export function LeaveActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", requestId);
      try {
        await approveLeaveAction(fd);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleReject(formData: FormData) {
    formData.set("id", requestId);
    startTransition(async () => {
      try {
        await rejectLeaveAction(formData);
        setShowReject(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <>
      <div className="flex gap-1 shrink-0">
        <Button onClick={handleApprove} disabled={pending} size="sm" className="h-7 px-2 text-xs">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button
          onClick={() => setShowReject(true)}
          disabled={pending}
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>Optionally provide a reason</DialogDescription>
          </DialogHeader>
          <form action={handleReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReject(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                Reject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
