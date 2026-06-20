"use client";

// "Apply holiday to employees" dialog. A holiday is just a definition until an
// admin applies it here — pick the employees who get these day(s) off (so Eid /
// national holidays can go to different people on different dates). Applying SETS
// the exact list: ticking adds, un-ticking removes; applying with none selected
// clears the holiday from everyone.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, CalendarOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  loadHolidayApplyDataAction,
  applyHolidayAction,
  type ApplyDialogData,
} from "../holiday-actions";

export type ApplyGroup = { ids: string[]; name: string; dateLabel: string };

export function HolidayApplyDialog({
  group,
  onClose,
}: {
  group: ApplyGroup | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<ApplyDialogData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!group) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSearch("");
    loadHolidayApplyDataAction(group.ids).then((d) => {
      setLoading(false);
      if (d) {
        setData(d);
        setSelected(new Set(d.applied));
      } else {
        setError("Failed to load employees");
      }
    });
  }, [group]);

  const employees = data?.employees ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? employees.filter(
        (e) => e.fullName.toLowerCase().includes(q) || e.empCode.toLowerCase().includes(q)
      )
    : employees;
  const allSelected = employees.length > 0 && employees.every((e) => selected.has(e.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function apply() {
    if (!group) return;
    startTransition(async () => {
      const res = await applyHolidayAction(group.ids, [...selected]);
      if (!res.ok) {
        setError(res.error ?? "Failed to apply");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open={group !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!h-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-primary" />
            Apply “{group?.name}”
          </DialogTitle>
          <DialogDescription>
            {group?.dateLabel} · choose the employees who get this off. Un-ticking removes it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees…"
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)))}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">No employees.</li>
              ) : (
                filtered.map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-muted/60">
                      <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                      <span className="flex-1 text-sm">{e.fullName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        <span className="font-mono">{e.empCode}</span>
                        {e.department ? ` · ${e.department}` : ""}
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                <Users className="mr-1 inline h-3.5 w-3.5" />
                {selected.size} selected
              </span>
              <Button type="button" onClick={apply} disabled={pending} className="flex w-[160px]">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Apply
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}