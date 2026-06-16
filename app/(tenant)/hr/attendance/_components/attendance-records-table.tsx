"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, SquarePen, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { toast } from "@/lib/toast";
import { updateAttendanceAction, deleteAttendanceAction } from "../../actions";

export type AttendanceRow = {
  id: string;
  employeeName: string;
  empCode: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workHours: number | null;
  status: string;
};

const STATUS_OPTIONS = [
  "present",
  "late",
  "absent",
  "half_day",
  "leave",
  "holiday",
];

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

// Hours between check-in/out — falls back to a live calc when the stored
// workHours hasn't been computed yet (e.g. record edited in to add a checkout).
function hoursOf(r: AttendanceRow): number | null {
  if (r.workHours != null) return r.workHours;
  if (r.checkIn && r.checkOut) {
    const ms = new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime();
    return ms > 0 ? Math.round((ms / 3_600_000) * 100) / 100 : 0;
  }
  return null;
}

// ISO → value for <input type="datetime-local"> (local wall-clock).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function AttendanceRecordsTable({ rows }: { rows: AttendanceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<AttendanceRow | null>(null);
  const [editing, setEditing] = useState<AttendanceRow | null>(null);

  function handleEdit(formData: FormData) {
    if (!editing) return;
    formData.set("id", editing.id);
    startTransition(async () => {
      const res = await updateAttendanceAction(formData);
      if (res.ok) {
        toast.success("Attendance updated");
        setEditing(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to update record");
      }
    });
  }

  const columns: Column<AttendanceRow>[] = [
    {
      key: "employee",
      header: "Employee",
      width: "26%",
      cell: (r) => (
        <div>
          <p className="font-medium text-sm">{r.employeeName}</p>
          <p className="text-xs text-muted-foreground font-mono">{r.empCode}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      width: "13%",
      className: "text-xs whitespace-nowrap",
      cell: (r) => fmtDate(r.date),
    },
    {
      key: "checkIn",
      header: "Check-in",
      width: "13%",
      className: "text-xs font-mono whitespace-nowrap",
      cell: (r) => (r.checkIn ? fmtTime(r.checkIn) : "—"),
    },
    {
      key: "checkOut",
      header: "Check-out",
      width: "13%",
      className: "text-xs font-mono whitespace-nowrap",
      cell: (r) => (r.checkOut ? fmtTime(r.checkOut) : "—"),
    },
    {
      key: "hours",
      header: "Hours",
      width: "9%",
      headClassName: "text-right",
      className: "text-right text-sm font-medium whitespace-nowrap",
      cell: (r) => {
        const h = hoursOf(r);
        return h != null ? h.toFixed(1) : "—";
      },
    },
    {
      key: "status",
      header: "Status",
      width: "13%",
      cell: (r) => (
        <Badge variant="outline" className="capitalize text-xs">
          {r.status.replace("_", " ")}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.id}
        itemNoun="records"
        tableMinWidth="1000px"
        actionsWidth="9rem"
        actionsCell={(r) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title="View record"
              onClick={() => setViewing(r)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title="Edit record"
              onClick={() => setEditing(r)}
            >
              <SquarePen className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        onBulkDelete={async (ids) => {
          await Promise.all(
            ids.map((id) => {
              const fd = new FormData();
              fd.set("id", id);
              return deleteAttendanceAction(fd);
            })
          );
          router.refresh();
        }}
        emptyState={
          <p className="text-sm text-muted-foreground">
            No attendance records yet. Use the panel to check in/out.
          </p>
        }
      />

      {/* View record */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.employeeName}</DialogTitle>
                <DialogDescription>
                  {viewing.empCode} · {fmtDate(viewing.date)}
                </DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-border/60 text-sm">
                {(
                  [
                    ["Check-in", viewing.checkIn ? fmtTime(viewing.checkIn) : "—"],
                    ["Check-out", viewing.checkOut ? fmtTime(viewing.checkOut) : "—"],
                    [
                      "Working hours",
                      hoursOf(viewing) != null
                        ? `${hoursOf(viewing)!.toFixed(2)} h`
                        : "—",
                    ],
                    ["Status", viewing.status.replace("_", " ")],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="text-right font-medium capitalize">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit record — adjust check-in / check-out / status; hours recompute */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit attendance</DialogTitle>
                <DialogDescription>
                  {editing.employeeName} · {editing.empCode} ·{" "}
                  {fmtDate(editing.date)}
                </DialogDescription>
              </DialogHeader>
              <form action={handleEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="att-checkin">
                      Check-in
                    </Label>
                    <Input
                      id="att-checkin"
                      name="checkIn"
                      type="datetime-local"
                      defaultValue={toLocalInput(editing.checkIn)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="att-checkout">
                      Check-out
                    </Label>
                    <Input
                      id="att-checkout"
                      name="checkOut"
                      type="datetime-local"
                      defaultValue={toLocalInput(editing.checkOut)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select name="status" defaultValue={editing.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Working hours are recalculated automatically from check-in and
                  check-out.
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
