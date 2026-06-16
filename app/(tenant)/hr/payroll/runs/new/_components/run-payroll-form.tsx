"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { runPayrollAction } from "../../../../actions-phase2";

export type PrepRow = {
  employeeId: string;
  empCode: string;
  name: string;
  designation: string;
  salaryGrade: string;
  baseSalary: number;
  absentDays: number;
  outstandingAdvance: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// Default absence deduction = (Basic ÷ 30) × absent days.
const formula = (base: number, days: number) => round2((base / 30) * days);

export function RunPayrollForm({
  disabled,
  prep,
}: {
  disabled: boolean;
  prep: PrepRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Per-employee editable state, prefilled from attendance + the formula.
  const [rows, setRows] = useState<
    Record<
      string,
      { days: string; deduction: string; reason: string; extraDuty: string }
    >
  >(() =>
    Object.fromEntries(
      prep.map((r) => [
        r.employeeId,
        {
          days: String(r.absentDays),
          deduction: String(formula(r.baseSalary, r.absentDays)),
          reason: "",
          extraDuty: "0",
        },
      ])
    )
  );

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  // Local YYYY-MM-DD — toISOString() would shift to UTC and roll the date back.
  const ymd = (d: Date) => d.toLocaleDateString("en-CA");

  // A row "changed" (and so needs a reason) if absent days differ from the
  // attendance default, or the deduction differs from the formula amount.
  function isChanged(r: PrepRow) {
    const st = rows[r.employeeId];
    if (!st) return false;
    const days = Number(st.days);
    const ded = Number(st.deduction);
    const daysChanged = days !== r.absentDays;
    const amountChanged = round2(ded) !== formula(r.baseSalary, days);
    return daysChanged || amountChanged;
  }

  function update(
    id: string,
    base: number,
    patch: Partial<{ days: string; deduction: string; reason: string; extraDuty: string }>
  ) {
    setRows((s) => {
      const next = { ...s[id], ...patch };
      // Changing the days auto-recomputes the deduction (admin can then
      // still override the amount manually afterwards).
      if (patch.days !== undefined) {
        const d = Number(patch.days);
        next.deduction = String(formula(base, Number.isFinite(d) ? d : 0));
      }
      return { ...s, [id]: next };
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    const missing = prep.find(
      (r) => isChanged(r) && !rows[r.employeeId]?.reason.trim()
    );
    if (missing) {
      setError(
        `Enter a reason for ${missing.name} — absence days/deduction was changed.`
      );
      return;
    }

    const adjustments: Record<
      string,
      { absentDays: number; deduction: number; reason?: string; extraDutyDays: number }
    > = {};
    for (const r of prep) {
      const st = rows[r.employeeId];
      const days = Number(st?.days);
      const ded = Number(st?.deduction);
      const ed = Number(st?.extraDuty);
      adjustments[r.employeeId] = {
        absentDays: Number.isFinite(days) && days >= 0 ? days : 0,
        deduction: Number.isFinite(ded) && ded >= 0 ? round2(ded) : 0,
        extraDutyDays: Number.isFinite(ed) && ed >= 0 ? ed : 0,
        ...(st?.reason.trim() ? { reason: st.reason.trim() } : {}),
      };
    }
    formData.set("adjustments", JSON.stringify(adjustments));

    startTransition(async () => {
      try {
        const res = await runPayrollAction(formData);
        if (res && !res.ok) {
          setError(res.error ?? "Failed");
          return;
        }
        router.push("/hr/payroll");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs">Period name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={`${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()}`}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="periodStart" className="text-xs">From</Label>
          <Input id="periodStart" name="periodStart" type="date" required defaultValue={ymd(monthStart)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodEnd" className="text-xs">To</Label>
          <Input id="periodEnd" name="periodEnd" type="date" required defaultValue={ymd(monthEnd)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payDate" className="text-xs">Pay date</Label>
        <Input id="payDate" name="payDate" type="date" required defaultValue={ymd(monthEnd)} />
      </div>

      {prep.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Adjustments — extra-duty &amp; absent days are per run. Extra Duty Payment
            and Absence Deduction = (Basic ÷ 30) × days. Editing absent days or the
            deduction requires a reason.
          </Label>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border/60">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--table-head)] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Emp</th>
                  <th className="px-2 py-1.5 text-right font-medium">Basic</th>
                  <th className="px-2 py-1.5 text-right font-medium">Adv. due</th>
                  <th className="px-2 py-1.5 text-right font-medium">Extra duty days</th>
                  <th className="px-2 py-1.5 text-right font-medium">Absent days</th>
                  <th className="px-2 py-1.5 text-right font-medium">Abs. deduction</th>
                  <th className="px-2 py-1.5 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {prep.map((r) => {
                  const st = rows[r.employeeId];
                  const changed = isChanged(r);
                  return (
                    <tr key={r.employeeId} className="border-t border-border/40">
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{r.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {r.empCode} · {r.designation}
                          {r.salaryGrade && r.salaryGrade !== "—" && (
                            <> · Grade {r.salaryGrade}</>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">{r.baseSalary.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-warning">
                        {r.outstandingAdvance > 0 ? r.outstandingAdvance.toLocaleString() : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={st?.extraDuty ?? "0"}
                          onChange={(e) =>
                            update(r.employeeId, r.baseSalary, { extraDuty: e.target.value })
                          }
                          className="h-7 w-16 text-right ml-auto"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={st?.days ?? "0"}
                          onChange={(e) => update(r.employeeId, r.baseSalary, { days: e.target.value })}
                          className="h-7 w-16 text-right ml-auto"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={st?.deduction ?? "0"}
                          onChange={(e) =>
                            update(r.employeeId, r.baseSalary, { deduction: e.target.value })
                          }
                          className="h-7 w-20 text-right ml-auto"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="text"
                          placeholder={changed ? "Reason required *" : "—"}
                          value={st?.reason ?? ""}
                          onChange={(e) =>
                            update(r.employeeId, r.baseSalary, { reason: e.target.value })
                          }
                          className={`h-7 min-w-40 ${
                            changed && !st?.reason.trim()
                              ? "border-destructive/60"
                              : ""
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use the reason for sickness, approved leave, or any manual change.
            Advances are recovered automatically per their installment.
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending || disabled}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Process Payroll Run
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground text-center">Setup required first ↑</p>
      )}
    </form>
  );
}
