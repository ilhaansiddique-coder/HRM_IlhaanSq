"use client";

import { useState, useTransition } from "react";
import { Eye, SquarePen, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { toast } from "@/lib/toast";
import {
  updateBreakSessionAction,
  deleteBreakSessionAction,
} from "../../actions";

export type BreakSessionRow = {
  id: string;
  employeeName: string;
  empCode: string;
  breakStart: string;
  breakEnd: string | null;
  durationMin: number;
  isDuty: boolean;
  notes: string | null;
  status: string;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function BreakSessionsTable({
  rows,
  showEmployee = false,
}: {
  rows: BreakSessionRow[];
  /** Admin view shows an Employee column, richer Type labels, AND the
   *  selection / bulk-delete / edit controls. The employee's own view stays
   *  read-only. */
  showEmployee?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<BreakSessionRow | null>(null);
  const [editing, setEditing] = useState<BreakSessionRow | null>(null);

  function handleEdit(formData: FormData) {
    if (!editing) return;
    formData.set("id", editing.id);
    startTransition(async () => {
      const res = await updateBreakSessionAction(formData);
      if (res.ok) {
        toast.success("Break session updated");
        setEditing(null);
      } else {
        toast.error(res.error ?? "Failed to update break");
      }
    });
  }

  const columns: Column<BreakSessionRow>[] = [];

  if (showEmployee) {
    columns.push({
      key: "employee",
      header: "Employee",
      width: "22%",
      cell: (s) => (
        <div>
          <p className="font-medium text-sm">{s.employeeName}</p>
          <p className="text-xs text-muted-foreground font-mono">{s.empCode}</p>
        </div>
      ),
    });
  } else {
    columns.push({
      key: "date",
      header: "Date",
      width: "22%",
      className: "text-xs whitespace-nowrap",
      cell: (s) => fmtDate(s.breakStart),
    });
  }

  columns.push(
    {
      key: "start",
      header: "Start",
      width: "18%",
      className: "text-xs font-mono whitespace-nowrap",
      cell: (s) =>
        showEmployee ? (
          <>
            {fmtTime(s.breakStart)}{" "}
            <span className="text-muted-foreground">
              {fmtDate(s.breakStart)}
            </span>
          </>
        ) : (
          fmtTime(s.breakStart)
        ),
    },
    {
      key: "end",
      header: "End",
      width: "12%",
      className: "text-xs font-mono whitespace-nowrap",
      cell: (s) => (s.breakEnd ? fmtTime(s.breakEnd) : "—"),
    },
    {
      key: "duration",
      header: "Duration",
      width: "10%",
      headClassName: "text-right",
      className: "text-right text-sm font-medium whitespace-nowrap",
      cell: (s) =>
        s.durationMin > 0 ? `${Math.round(s.durationMin)} min` : "—",
    },
    {
      key: "type",
      header: "Type",
      width: "22%",
      cell: (s) => (
        <>
          <Badge variant={s.isDuty ? "default" : "secondary"} className="text-xs">
            {s.isDuty
              ? "Courier · duty"
              : showEmployee
                ? "Personal · out of duty"
                : "Personal"}
          </Badge>
          {showEmployee && s.notes ? (
            <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground">
              {s.notes}
            </p>
          ) : null}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      cell: (s) => (
        <Badge
          variant={s.status === "active" ? "secondary" : "outline"}
          className="capitalize text-xs"
        >
          {s.status}
        </Badge>
      ),
    }
  );

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(s) => s.id}
        itemNoun="sessions"
        selectable={showEmployee}
        tableMinWidth={showEmployee ? "1080px" : undefined}
        actionsWidth={showEmployee ? "9rem" : undefined}
        actionsCell={
          showEmployee
            ? (s) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    title="View session"
                    onClick={() => setViewing(s)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    title="Edit session"
                    onClick={() => setEditing(s)}
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </Button>
                </>
              )
            : undefined
        }
        onBulkDelete={
          showEmployee
            ? async (ids) => {
                await Promise.all(
                  ids.map((id) => {
                    const fd = new FormData();
                    fd.set("id", id);
                    return deleteBreakSessionAction(fd);
                  })
                );
              }
            : undefined
        }
        emptyState={
          <p className="text-sm text-muted-foreground">
            No break sessions recorded yet.
          </p>
        }
      />

      {/* View session */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.employeeName}</DialogTitle>
                <DialogDescription>
                  {viewing.empCode} · {fmtDate(viewing.breakStart)}
                </DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-border/60 text-sm">
                {(
                  [
                    ["Start", fmtTime(viewing.breakStart)],
                    ["End", viewing.breakEnd ? fmtTime(viewing.breakEnd) : "—"],
                    [
                      "Duration",
                      viewing.durationMin > 0
                        ? `${Math.round(viewing.durationMin)} min`
                        : "—",
                    ],
                    [
                      "Type",
                      viewing.isDuty ? "Courier · duty" : "Personal · out of duty",
                    ],
                    ["Status", viewing.status],
                    ["Reason", viewing.notes || "—"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-start justify-between gap-4 py-2"
                  >
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="max-w-[60%] text-right font-medium capitalize">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit session — adjust times / reason; duration & type recompute */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit break session</DialogTitle>
                <DialogDescription>
                  {editing.employeeName} · {editing.empCode}
                </DialogDescription>
              </DialogHeader>
              <form action={handleEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="brk-start">
                      Start
                    </Label>
                    <DateTimePicker
                      id="brk-start"
                      name="breakStart"
                      defaultValue={toLocalInput(editing.breakStart)}
                      placeholder="Break start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="brk-end">
                      End
                    </Label>
                    <DateTimePicker
                      id="brk-end"
                      name="breakEnd"
                      defaultValue={toLocalInput(editing.breakEnd)}
                      placeholder="Break end"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="brk-note">
                    Reason
                  </Label>
                  <textarea
                    id="brk-note"
                    name="note"
                    rows={2}
                    defaultValue={editing.notes ?? ""}
                    placeholder="Mention courier if it's a work errand"
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Duration and duty type are recalculated automatically.
                </p>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
