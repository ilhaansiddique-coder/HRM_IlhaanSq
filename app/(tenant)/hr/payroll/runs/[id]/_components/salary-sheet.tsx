"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SquarePen, Save, X, Loader2, CheckCircle2, Circle } from "lucide-react";
import {
  updatePayslipAction,
  setPayslipPaidAction,
  setPayslipCustomValueAction,
} from "../../../../actions-phase2";

export type CustomCol = {
  id: string;
  name: string; // full name (tooltip)
  shortLabel: string; // header text
  group: "earning" | "deduction";
  formula: string; // e.g. "House Rent × 2" (tooltip)
  manual: boolean; // true = admin types a value per employee
};

export type Slip = {
  id: string;
  runId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  salaryGrade: string;
  basicSalary: number;
  houseRent: number;
  health: number;
  education: number;
  savings: number;
  dailyHand: number;
  totalEarnings: number; // gross
  extraDutyDays: number;
  extraDutyPayment: number;
  totalSalary: number;
  advanceOutstanding: number; // total outstanding advance balance (read-only)
  advanceRecovered: number;
  breakPenalty: number;
  absentDays: number;
  absenceDeduction: number;
  absenceReason: string | null;
  payableSalary: number;
  otherDeductions: number;
  custom: Record<string, number>; // colId -> computed value
  paidAt: string | null; // formatted date or null
  paidByName: string | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

// Earnings custom columns add to Total Salary; deduction custom columns
// subtract from Net Payable (display-time only — stored payslips untouched).
// When `cf` (the row's in-edit custom values) is passed, a MANUAL column's
// contribution uses the value being typed — so Total Salary / Net Payable
// react live, before saving, exactly like the base columns.
function customSums(
  slip: Slip,
  earn: CustomCol[],
  ded: CustomCol[],
  cf?: Record<string, string>
): { earn: number; ded: number } {
  const val = (c: CustomCol) =>
    cf && c.manual && cf[c.id] !== undefined
      ? Number(cf[c.id]) || 0
      : slip.custom[c.id] ?? 0;
  return {
    earn: round2(earn.reduce((a, c) => a + val(c), 0)),
    ded: round2(ded.reduce((a, c) => a + val(c), 0)),
  };
}

// ─── Styling tokens (table) ──────────────────────────────────
const HEAD = "px-2.5 py-2 text-[11px] font-semibold whitespace-nowrap";
const NUM =
  "px-2.5 py-1.5 text-sm font-medium text-right tabular-nums whitespace-nowrap";
const META = "px-2.5 py-1.5 text-xs whitespace-nowrap";

const H_META = `${HEAD} bg-base-200 text-base-content/70`;
const H_GROSS = `${HEAD} bg-slate-700 text-right text-white`;
const H_TOTAL = `${HEAD} bg-slate-700 text-right text-white`;
const H_NET = `${HEAD} bg-indigo-600 text-right text-white`;
const H_EARN = `${HEAD} bg-emerald-200 text-right text-emerald-950`;
const H_DED = `${HEAD} bg-rose-200 text-right text-rose-950`;

const C_EARN = `${NUM} bg-emerald-500/10`;
const C_DED = `${NUM} bg-rose-500/10`;
const C_GROSS = `${NUM} bg-base-200/50 font-semibold`;
const C_TOTAL = `${NUM} bg-base-200/50 font-semibold`;
const C_NET = `${NUM} bg-indigo-500/15 font-bold text-base-content`;

// Built-in money columns: short header + full name + relationship (tooltip).
type Col = { short: string; full: string; rel: string; key?: string };
const GROSS: Col = {
  short: "Gross Salary",
  full: "Gross Salary",
  rel: "Basic + House Rent + Health + Education + Savings + Daily Hand",
};
const TOTAL: Col = {
  short: "Total Salary",
  full: "Total Salary",
  rel: "Gross Salary + Extra Duty Pay + custom Earnings columns",
};
const NET: Col = {
  short: "Net Payable",
  full: "Net Payable",
  rel: "Total Salary − all deductions − custom Deductions columns",
};
const EARN_COLS: Col[] = [
  { key: "basicSalary", short: "Basic", full: "Basic Salary", rel: "Base monthly salary" },
  { key: "houseRent", short: "H.Rent", full: "House Rent", rel: "House rent allowance" },
  { key: "health", short: "Health", full: "Health Allowance", rel: "Health allowance" },
  { key: "education", short: "Education", full: "Education Allowance", rel: "Education allowance" },
  { key: "savings", short: "Savings", full: "Savings", rel: "Savings component" },
  { key: "dailyHand", short: "D.H.Expenses", full: "Daily Hand Expenses", rel: "Daily hand expenses" },
  { short: "E.D.Pay", full: "Extra Duty Pay", rel: "(Basic ÷ 30) × Extra Duty Days" },
  { key: "extraDutyDays", short: "E.D.Days", full: "Extra Duty Days", rel: "Number of extra-duty days" },
];
const DED_COLS: Col[] = [
  { short: "T.Advance", full: "Total Advance", rel: "Total outstanding advance balance (active advances)" },
  { key: "advanceRecovered", short: "Advance", full: "Advance Recovery", rel: "Recovered this period. Editable — syncs with the Advances page installment for this employee." },
  { key: "absentDays", short: "A. Days", full: "Absent Days", rel: "Number of absent days" },
  { short: "A.D. Deduction", full: "Absence Deduction", rel: "(Basic ÷ 30) × Absent Days" },
  { key: "breakPenalty", short: "Brk. Penalty", full: "Break Penalty", rel: "Penalty for exceeded break time" },
];

// Per-tenant rename overrides for built-in columns (fieldKey → labels).
export type BaseLabelMap = Record<
  string,
  { label: string; shortLabel: string }
>;
// Apply a rename override to a built-in column's header, if one exists.
function applyBase(col: Col, m?: BaseLabelMap): Col {
  const o = col.key ? m?.[col.key] : undefined;
  return o ? { ...col, short: o.shortLabel, full: o.label } : col;
}

function HdrCell({ col, className }: { col: Col; className: string }) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted decoration-from-font underline-offset-2">
            {col.short}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="font-semibold">{col.full}</div>
          <div className="text-xs opacity-80">{col.rel}</div>
        </TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

// ─── Shared edit state (table row + mobile card) ─────────────
type FormState = {
  basic: string;
  houseRent: string;
  health: string;
  education: string;
  savings: string;
  dailyHand: string;
  extraDutyDays: string;
  absentDays: string;
  advanceRecovered: string;
  absenceReason: string;
};

function usePayslipEdit(slip: Slip, manualCols: CustomCol[] = []) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Manual custom-column values — edited inside the row's edit mode and
  // saved together with the row (NOT an always-open field).
  const initialCustom = (): Record<string, string> =>
    Object.fromEntries(
      manualCols.map((c) => [c.id, String(slip.custom[c.id] ?? 0)])
    );
  const [cf, setCf] = useState<Record<string, string>>(initialCustom);

  const initial = (): FormState => ({
    basic: String(slip.basicSalary),
    houseRent: String(slip.houseRent),
    health: String(slip.health),
    education: String(slip.education),
    savings: String(slip.savings),
    dailyHand: String(slip.dailyHand),
    extraDutyDays: String(slip.extraDutyDays),
    absentDays: String(slip.absentDays),
    advanceRecovered: String(slip.advanceRecovered),
    absenceReason: slip.absenceReason ?? "",
  });
  const [f, setF] = useState<FormState>(initial);

  const n = (v: string) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };

  const basic = n(f.basic);
  const gross = round2(
    basic + n(f.houseRent) + n(f.health) + n(f.education) + n(f.savings) + n(f.dailyHand)
  );
  const extraDutyPayment = round2((basic / 30) * n(f.extraDutyDays));
  const totalSalary = round2(gross + extraDutyPayment);
  const absenceDeduction = round2((basic / 30) * n(f.absentDays));
  const payable = round2(
    totalSalary - slip.otherDeductions - absenceDeduction - n(f.advanceRecovered)
  );

  function reset() {
    setF(initial());
    setCf(initialCustom());
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("payslipId", slip.id);
    fd.set("runId", slip.runId);
    fd.set("basic", f.basic);
    fd.set("houseRent", f.houseRent);
    fd.set("health", f.health);
    fd.set("education", f.education);
    fd.set("savings", f.savings);
    fd.set("dailyHand", f.dailyHand);
    fd.set("extraDutyDays", f.extraDutyDays);
    fd.set("absentDays", f.absentDays);
    fd.set("advanceRecovered", f.advanceRecovered);
    fd.set("absenceReason", f.absenceReason);
    startTransition(async () => {
      try {
        await updatePayslipAction(fd);
        // Persist any changed manual custom-column values for this row.
        for (const c of manualCols) {
          const next = (cf[c.id] ?? "").trim();
          const orig = String(slip.custom[c.id] ?? 0);
          if (next === orig) continue;
          const cvd = new FormData();
          cvd.set("payslipId", slip.id);
          cvd.set("columnId", c.id);
          cvd.set("runId", slip.runId);
          cvd.set("value", next === "" ? "0" : next);
          const r = await setPayslipCustomValueAction(cvd);
          if (!r.ok) throw new Error(r.error ?? "Failed to save column value");
        }
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return {
    editing, setEditing, pending, error, f, setF, cf, setCf,
    gross, extraDutyPayment, totalSalary, absenceDeduction, payable,
    reset, save,
  };
}

function usePaidToggle(slip: Slip) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paid = !!slip.paidAt;
  function toggle() {
    setError(null);
    const fd = new FormData();
    fd.set("payslipId", slip.id);
    fd.set("runId", slip.runId);
    fd.set("paid", String(!paid));
    start(async () => {
      const r = await setPayslipPaidAction(fd);
      if (!r.ok) {
        setError(r.error ?? "Failed");
        return;
      }
    });
  }
  return { paid, pending, error, toggle };
}

function PaidControl({
  slip,
  canEdit,
  block,
}: {
  slip: Slip;
  canEdit: boolean;
  block?: boolean;
}) {
  const { paid, pending, toggle } = usePaidToggle(slip);
  if (paid) {
    return (
      <button
        type="button"
        disabled={!canEdit || pending}
        onClick={toggle}
        title={
          canEdit
            ? "Click to mark as unpaid"
            : slip.paidByName
            ? `Paid by ${slip.paidByName}`
            : "Paid"
        }
        className={`inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white ${
          block ? "w-full" : ""
        } ${canEdit ? "hover:bg-emerald-700" : "cursor-default"} disabled:opacity-60`}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Paid{slip.paidAt ? ` · ${slip.paidAt}` : ""}
      </button>
    );
  }
  if (!canEdit) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Circle className="h-3.5 w-3.5" /> Pending
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={toggle}
      className={`h-7 gap-1 px-2 text-xs ${block ? "w-full" : ""}`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      Mark Paid
    </Button>
  );
}

export function SalarySheet({
  slips,
  canEdit,
  customColumns,
  baseLabels,
}: {
  slips: Slip[];
  canEdit: boolean;
  customColumns: CustomCol[];
  baseLabels?: BaseLabelMap;
}) {
  if (slips.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No payslips in this run.
      </p>
    );
  }

  const earnCustom = customColumns.filter((c) => c.group === "earning");
  const dedCustom = customColumns.filter((c) => c.group === "deduction");

  const t = slips.reduce(
    (a, s) => {
      const cu = { ...a.custom };
      for (const c of customColumns)
        cu[c.id] = (cu[c.id] ?? 0) + (s.custom[c.id] ?? 0);
      return {
        gross: a.gross + s.totalEarnings,
        basic: a.basic + s.basicSalary,
        houseRent: a.houseRent + s.houseRent,
        health: a.health + s.health,
        education: a.education + s.education,
        savings: a.savings + s.savings,
        dailyHand: a.dailyHand + s.dailyHand,
        extraDutyPayment: a.extraDutyPayment + s.extraDutyPayment,
        extraDutyDays: a.extraDutyDays + s.extraDutyDays,
        totalSalary: a.totalSalary + s.totalSalary,
        advanceOutstanding: a.advanceOutstanding + s.advanceOutstanding,
        advance: a.advance + s.advanceRecovered,
        absentDays: a.absentDays + s.absentDays,
        absenceDeduction: a.absenceDeduction + s.absenceDeduction,
        payable: a.payable + s.payableSalary,
        custom: cu,
      };
    },
    {
      gross: 0, basic: 0, houseRent: 0, health: 0, education: 0, savings: 0,
      dailyHand: 0, extraDutyPayment: 0, extraDutyDays: 0, totalSalary: 0,
      advanceOutstanding: 0, advance: 0, absentDays: 0, absenceDeduction: 0, payable: 0,
      custom: {} as Record<string, number>,
    }
  );

  const earnTot = earnCustom.reduce((a, c) => a + (t.custom[c.id] ?? 0), 0);
  const dedTot = dedCustom.reduce((a, c) => a + (t.custom[c.id] ?? 0), 0);
  const totalSalaryShown = round2(t.totalSalary + earnTot);
  const payableShown = round2(t.payable + earnTot - dedTot);

  return (
    <>
      {/* ── Mobile: one card per employee ───────────────────── */}
      <div className="min-w-0 space-y-3 md:hidden">
        {slips.map((s, i) => (
          <SheetCard
            key={s.id}
            slip={s}
            index={i}
            canEdit={canEdit}
            earnCustom={earnCustom}
            dedCustom={dedCustom}
          />
        ))}

        <div className="overflow-hidden rounded-xl border-2 border-base-content/40 bg-base-200/60">
          <div className="bg-base-300 px-3 py-2 text-xs font-bold uppercase tracking-wide">
            Total · {slips.length} employee{slips.length !== 1 ? "s" : ""}
          </div>
          <CardLine label="Gross Salary" value={fmt(round2(t.gross))} />
          <CardLine label="Total Salary" value={fmt(totalSalaryShown)} />
          <CardLine label="Total Advance" value={fmt(round2(t.advanceOutstanding))} tone="ded" />
          <CardLine label="Advance Recovery" value={fmt(round2(t.advance))} tone="ded" />
          <CardLine label="Absence Deduction" value={fmt(round2(t.absenceDeduction))} tone="ded" />
          <div className="flex items-center justify-between bg-indigo-600 px-3 py-2.5 text-white">
            <span className="text-sm font-bold">NET PAYABLE</span>
            <span className="text-base font-bold tabular-nums">
              {fmt(payableShown)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tablet / desktop: full table ────────────────────── */}
      <div className="hidden md:block">
        <TooltipProvider delayDuration={150}>
          <Table className="border-collapse [&_td]:border [&_td]:border-base-content/30 [&_th]:border [&_th]:border-base-content/30">
            <TableHeader>
              {/* Earnings / Deductions group band */}
              <TableRow className="hover:bg-transparent">
                <TableHead colSpan={6} className="bg-base-200" />
                <TableHead
                  colSpan={8 + earnCustom.length}
                  className={`${HEAD} bg-emerald-600 text-center text-sm tracking-wide text-white`}
                >
                  EARNINGS&nbsp;&nbsp;( + )
                </TableHead>
                <TableHead colSpan={1} className="bg-base-200" />
                <TableHead
                  colSpan={4 + dedCustom.length}
                  className={`${HEAD} bg-rose-600 text-center text-sm tracking-wide text-white`}
                >
                  DEDUCTIONS&nbsp;&nbsp;( − )
                </TableHead>
                <TableHead colSpan={1} className="bg-base-200" />
                <TableHead colSpan={1} className="bg-base-200" />
                {canEdit && <TableHead colSpan={1} className="bg-base-200" />}
              </TableRow>

              {/* Column headers */}
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${H_META} w-8 text-center`}>#</TableHead>
                <TableHead className={H_META}>Emp ID</TableHead>
                <TableHead className={H_META}>Employee</TableHead>
                <TableHead className={H_META}>Designation</TableHead>
                <TableHead className={H_META}>Salary Grade</TableHead>
                <HdrCell col={GROSS} className={H_GROSS} />
                {EARN_COLS.map((c) => (
                  <HdrCell
                    key={c.short}
                    col={applyBase(c, baseLabels)}
                    className={H_EARN}
                  />
                ))}
                {earnCustom.map((c) => (
                  <HdrCell
                    key={c.id}
                    col={{ short: c.shortLabel, full: c.name, rel: c.formula }}
                    className={H_EARN}
                  />
                ))}
                <HdrCell col={TOTAL} className={H_TOTAL} />
                {DED_COLS.map((c) => (
                  <HdrCell
                    key={c.short}
                    col={applyBase(c, baseLabels)}
                    className={H_DED}
                  />
                ))}
                {dedCustom.map((c) => (
                  <HdrCell
                    key={c.id}
                    col={{ short: c.shortLabel, full: c.name, rel: c.formula }}
                    className={H_DED}
                  />
                ))}
                <HdrCell col={NET} className={H_NET} />
                <TableHead className={`${H_META} text-center`}>Status</TableHead>
                {canEdit && (
                  <TableHead className={`${H_META} text-center`}>Edit</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {slips.map((s, i) => (
                <SheetRow
                  key={s.id}
                  slip={s}
                  index={i}
                  canEdit={canEdit}
                  earnCustom={earnCustom}
                  dedCustom={dedCustom}
                />
              ))}
            </TableBody>

            <TableFooter>
              <TableRow className="border-t-2 border-base-content/50 bg-base-200/70 font-bold hover:bg-base-200/70">
                <TableCell
                  colSpan={5}
                  className={`${META} text-right uppercase tracking-wide`}
                >
                  Total · {slips.length} employee{slips.length !== 1 ? "s" : ""}
                </TableCell>
                <TableCell className={C_GROSS}>{fmt(round2(t.gross))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.basic))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.houseRent))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.health))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.education))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.savings))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.dailyHand))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.extraDutyPayment))}</TableCell>
                <TableCell className={C_EARN}>{fmt(round2(t.extraDutyDays))}</TableCell>
                {earnCustom.map((c) => (
                  <TableCell key={c.id} className={C_EARN}>
                    {fmt(round2(t.custom[c.id] ?? 0))}
                  </TableCell>
                ))}
                <TableCell className={C_TOTAL}>{fmt(totalSalaryShown)}</TableCell>
                <TableCell className={C_DED}>{fmt(round2(t.advanceOutstanding))}</TableCell>
                <TableCell className={C_DED}>{fmt(round2(t.advance))}</TableCell>
                <TableCell className={C_DED}>{fmt(round2(t.absentDays))}</TableCell>
                <TableCell className={C_DED}>{fmt(round2(t.absenceDeduction))}</TableCell>
                {dedCustom.map((c) => (
                  <TableCell key={c.id} className={C_DED}>
                    {fmt(round2(t.custom[c.id] ?? 0))}
                  </TableCell>
                ))}
                <TableCell className={C_NET}>{fmt(payableShown)}</TableCell>
                <TableCell className={META} />
                {canEdit && <TableCell className={META} />}
              </TableRow>
            </TableFooter>
          </Table>
        </TooltipProvider>
      </div>
    </>
  );
}

// ─── Mobile card helpers ─────────────────────────────────────
function CardLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "earn" | "ded";
}) {
  const bg =
    tone === "earn"
      ? "bg-emerald-500/10"
      : tone === "ded"
      ? "bg-rose-500/10"
      : "";
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-base-content/15 px-3 py-2 text-sm last:border-b-0 ${bg}`}
    >
      <span className="min-w-0 break-words font-medium text-base-content/80">
        {label}
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}


function EditLine({
  label,
  value,
  onChange,
  step = "0.01",
  tone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  tone?: "earn" | "ded";
}) {
  const bg =
    tone === "earn"
      ? "bg-emerald-500/10"
      : tone === "ded"
      ? "bg-rose-500/10"
      : "";
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-base-content/15 px-3 py-2 last:border-b-0 ${bg}`}
    >
      <span className="min-w-0 flex-1 break-words text-sm font-medium text-base-content/80">
        {label}
      </span>
      <Input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-28 shrink-0 text-right tabular-nums"
      />
    </div>
  );
}

function SheetCard({
  slip,
  index,
  canEdit,
  earnCustom,
  dedCustom,
}: {
  slip: Slip;
  index: number;
  canEdit: boolean;
  earnCustom: CustomCol[];
  dedCustom: CustomCol[];
}) {
  const e = usePayslipEdit(
    slip,
    [...earnCustom, ...dedCustom].filter((c) => c.manual)
  );
  const set = (k: keyof FormState) => (v: string) =>
    e.setF((s) => ({ ...s, [k]: v }));
  const paid = !!slip.paidAt;
  const cs = customSums(
    slip,
    earnCustom,
    dedCustom,
    e.editing ? e.cf : undefined
  );

  return (
    <div
      className={`w-full min-w-0 overflow-hidden rounded-xl border shadow-sm ${
        paid
          ? "border-emerald-500/60 bg-emerald-500/5"
          : "border-base-content/25 bg-base-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-base-200 px-3 py-2.5">
        <div className="min-w-0">
          <div className="font-semibold break-words">
            <span className="mr-1.5 text-muted-foreground">#{index + 1}</span>
            {slip.employeeName}
          </div>
          <div className="break-words text-xs text-muted-foreground">
            <span className="font-mono">{slip.employeeCode}</span> ·{" "}
            {slip.designation}
            {slip.salaryGrade && slip.salaryGrade !== "—" && (
              <> · Grade {slip.salaryGrade}</>
            )}
          </div>
        </div>
        {canEdit && !e.editing && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={() => e.setEditing(true)}
          >
            <SquarePen className="h-3 w-3" /> Edit
          </Button>
        )}
      </div>

      <CardLine label="Gross Salary" value={fmt(e.editing ? e.gross : slip.totalEarnings)} />

      {/* Earnings */}
      <div className="bg-emerald-600 px-3 py-1.5 text-xs font-bold tracking-wide text-white">
        EARNINGS&nbsp;&nbsp;( + )
      </div>
      {e.editing ? (
        <>
          <EditLine label="Basic" tone="earn" value={e.f.basic} onChange={set("basic")} />
          <EditLine label="House Rent" tone="earn" value={e.f.houseRent} onChange={set("houseRent")} />
          <EditLine label="Health" tone="earn" value={e.f.health} onChange={set("health")} />
          <EditLine label="Education" tone="earn" value={e.f.education} onChange={set("education")} />
          <EditLine label="Savings" tone="earn" value={e.f.savings} onChange={set("savings")} />
          <EditLine label="Daily Hand Expenses" tone="earn" value={e.f.dailyHand} onChange={set("dailyHand")} />
          <CardLine label="Extra Duty Pay" tone="earn" value={fmt(e.extraDutyPayment)} />
          <EditLine label="Extra Duty Days" tone="earn" step="0.5" value={e.f.extraDutyDays} onChange={set("extraDutyDays")} />
        </>
      ) : (
        <>
          <CardLine label="Basic" tone="earn" value={fmt(slip.basicSalary)} />
          <CardLine label="House Rent" tone="earn" value={fmt(slip.houseRent)} />
          <CardLine label="Health" tone="earn" value={fmt(slip.health)} />
          <CardLine label="Education" tone="earn" value={fmt(slip.education)} />
          <CardLine label="Savings" tone="earn" value={fmt(slip.savings)} />
          <CardLine label="Daily Hand Expenses" tone="earn" value={fmt(slip.dailyHand)} />
          <CardLine label="Extra Duty Pay" tone="earn" value={fmt(slip.extraDutyPayment)} />
          <CardLine label="Extra Duty Days" tone="earn" value={fmt(slip.extraDutyDays)} />
        </>
      )}
      {earnCustom.map((c) =>
        e.editing && c.manual ? (
          <EditLine
            key={c.id}
            label={c.name}
            tone="earn"
            value={e.cf[c.id] ?? ""}
            onChange={(v) => e.setCf((s) => ({ ...s, [c.id]: v }))}
          />
        ) : (
          <CardLine
            key={c.id}
            label={`${c.name} (${c.formula})`}
            tone="earn"
            value={fmt(slip.custom[c.id] ?? 0)}
          />
        )
      )}

      {/* Total Salary */}
      <div className="flex items-center justify-between bg-slate-700 px-3 py-2.5 text-white">
        <span className="text-sm font-bold tracking-wide">TOTAL SALARY</span>
        <span className="text-base font-bold tabular-nums">
          {fmt(round2((e.editing ? e.totalSalary : slip.totalSalary) + cs.earn))}
        </span>
      </div>

      {/* Deductions */}
      <div className="bg-rose-600 px-3 py-1.5 text-xs font-bold tracking-wide text-white">
        DEDUCTIONS&nbsp;&nbsp;( − )
      </div>
      {e.editing ? (
        <>
          <CardLine label="Total Advance" tone="ded" value={fmt(slip.advanceOutstanding)} />
          <EditLine label="Advance Recovery" tone="ded" value={e.f.advanceRecovered} onChange={set("advanceRecovered")} />
          <EditLine label="Absent Days" tone="ded" step="0.5" value={e.f.absentDays} onChange={set("absentDays")} />
          <CardLine label="Absence Deduction" tone="ded" value={fmt(e.absenceDeduction)} />
          <div className="border-b border-base-content/15 bg-rose-500/10 px-3 py-2">
            <span className="text-sm text-muted-foreground">Absence reason</span>
            <Input
              type="text"
              placeholder="Reason (if absence adjusted)"
              value={e.f.absenceReason}
              onChange={(ev) => set("absenceReason")(ev.target.value)}
              className="mt-1 h-8 w-full text-sm"
            />
          </div>
        </>
      ) : (
        <>
          <CardLine label="Total Advance" tone="ded" value={fmt(slip.advanceOutstanding)} />
          <CardLine label="Advance Recovery" tone="ded" value={fmt(slip.advanceRecovered)} />
          <CardLine label="Absent Days" tone="ded" value={fmt(slip.absentDays)} />
          <CardLine label="Absence Deduction" tone="ded" value={fmt(slip.absenceDeduction)} />
          {slip.absenceReason && (
            <div className="border-b border-base-content/15 bg-rose-500/10 px-3 py-2 text-xs text-warning">
              Absence reason: {slip.absenceReason}
            </div>
          )}
        </>
      )}
      {dedCustom.map((c) =>
        e.editing && c.manual ? (
          <EditLine
            key={c.id}
            label={c.name}
            tone="ded"
            value={e.cf[c.id] ?? ""}
            onChange={(v) => e.setCf((s) => ({ ...s, [c.id]: v }))}
          />
        ) : (
          <CardLine
            key={c.id}
            label={`${c.name} (${c.formula})`}
            tone="ded"
            value={fmt(slip.custom[c.id] ?? 0)}
          />
        )
      )}

      {/* Net payable */}
      <div className="flex items-center justify-between bg-indigo-600 px-3 py-3 text-white">
        <span className="text-sm font-bold">NET PAYABLE</span>
        <span className="text-lg font-bold tabular-nums">
          {fmt(
            round2(
              (e.editing ? e.payable : slip.payableSalary) +
                cs.earn -
                cs.ded
            )
          )}
        </span>
      </div>

      {/* Status / paid */}
      <div className="flex items-center justify-between gap-2 border-t border-base-content/15 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        <div className="min-w-[7rem]">
          <PaidControl slip={slip} canEdit={canEdit} block />
        </div>
      </div>

      {/* Edit actions */}
      {e.editing && (
        <div className="space-y-2 border-t border-base-content/20 bg-base-200/60 px-3 py-3">
          {e.error && <div className="text-xs text-destructive">{e.error}</div>}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1" onClick={e.save} disabled={e.pending}>
              {e.pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={e.reset} disabled={e.pending}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SheetRow({
  slip,
  index,
  canEdit,
  earnCustom,
  dedCustom,
}: {
  slip: Slip;
  index: number;
  canEdit: boolean;
  earnCustom: CustomCol[];
  dedCustom: CustomCol[];
}) {
  const e = usePayslipEdit(
    slip,
    [...earnCustom, ...dedCustom].filter((c) => c.manual)
  );
  const paid = !!slip.paidAt;
  const cs = customSums(
    slip,
    earnCustom,
    dedCustom,
    e.editing ? e.cf : undefined
  );

  const cell = (key: keyof FormState, step = "0.01") => (
    <Input
      type="number"
      min="0"
      step={step}
      value={e.f[key]}
      onChange={(ev) => e.setF((s) => ({ ...s, [key]: ev.target.value }))}
      className="ml-auto h-7 w-20 text-right tabular-nums"
    />
  );

  if (!e.editing) {
    return (
      <TableRow
        className={
          paid
            ? "bg-emerald-500/15 hover:bg-emerald-500/20"
            : "odd:bg-base-100 even:bg-base-200/30"
        }
      >
        <TableCell className={`${META} text-center text-muted-foreground`}>
          {index + 1}
        </TableCell>
        <TableCell className={`${META} font-mono text-muted-foreground`}>
          {slip.employeeCode}
        </TableCell>
        <TableCell className={`${META} font-medium`}>
          {slip.employeeName}
          {slip.absenceReason && (
            <div className="text-[10px] font-normal text-warning">
              Absence: {slip.absenceReason}
            </div>
          )}
        </TableCell>
        <TableCell className={`${META} text-muted-foreground`}>
          {slip.designation}
        </TableCell>
        <TableCell className={`${META} text-muted-foreground`}>
          {slip.salaryGrade}
        </TableCell>
        <TableCell className={C_GROSS}>{fmt(slip.totalEarnings)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.basicSalary)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.houseRent)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.health)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.education)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.savings)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.dailyHand)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.extraDutyPayment)}</TableCell>
        <TableCell className={C_EARN}>{fmt(slip.extraDutyDays)}</TableCell>
        {earnCustom.map((c) => (
          <TableCell key={c.id} className={C_EARN}>
            {fmt(slip.custom[c.id] ?? 0)}
          </TableCell>
        ))}
        <TableCell className={C_TOTAL}>
          {fmt(round2(slip.totalSalary + cs.earn))}
        </TableCell>
        <TableCell className={C_DED}>{fmt(slip.advanceOutstanding)}</TableCell>
        <TableCell className={C_DED}>{fmt(slip.advanceRecovered)}</TableCell>
        <TableCell className={C_DED}>{fmt(slip.absentDays)}</TableCell>
        <TableCell className={C_DED}>{fmt(slip.absenceDeduction)}</TableCell>
        {dedCustom.map((c) => (
          <TableCell key={c.id} className={C_DED}>
            {fmt(slip.custom[c.id] ?? 0)}
          </TableCell>
        ))}
        <TableCell className={C_NET}>
          {fmt(round2(slip.payableSalary + cs.earn - cs.ded))}
        </TableCell>
        <TableCell className={`${META} text-center`}>
          <PaidControl slip={slip} canEdit={canEdit} />
        </TableCell>
        {canEdit && (
          <TableCell className={`${META} text-center`}>
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto h-7 w-7"
              onClick={() => e.setEditing(true)}
              title="Edit row"
            >
              <SquarePen className="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-primary/5 align-top hover:bg-primary/5">
      <TableCell className={`${META} text-center text-muted-foreground`}>
        {index + 1}
      </TableCell>
      <TableCell className={`${META} font-mono text-muted-foreground`}>
        {slip.employeeCode}
      </TableCell>
      <TableCell className={`${META} font-medium`}>
        {slip.employeeName}
        <Input
          type="text"
          placeholder="Absence reason"
          value={e.f.absenceReason}
          onChange={(ev) =>
            e.setF((s) => ({ ...s, absenceReason: ev.target.value }))
          }
          className="mt-1 h-7 w-44 text-xs"
        />
        {e.error && (
          <div className="mt-1 text-[10px] text-destructive">{e.error}</div>
        )}
      </TableCell>
      <TableCell className={`${META} text-muted-foreground`}>
        {slip.designation}
      </TableCell>
      <TableCell className={`${META} text-muted-foreground`}>
        {slip.salaryGrade}
      </TableCell>
      <TableCell className={C_GROSS}>{fmt(e.gross)}</TableCell>
      <TableCell className={C_EARN}>{cell("basic")}</TableCell>
      <TableCell className={C_EARN}>{cell("houseRent")}</TableCell>
      <TableCell className={C_EARN}>{cell("health")}</TableCell>
      <TableCell className={C_EARN}>{cell("education")}</TableCell>
      <TableCell className={C_EARN}>{cell("savings")}</TableCell>
      <TableCell className={C_EARN}>{cell("dailyHand")}</TableCell>
      <TableCell className={C_EARN}>{fmt(e.extraDutyPayment)}</TableCell>
      <TableCell className={C_EARN}>{cell("extraDutyDays", "0.5")}</TableCell>
      {earnCustom.map((c) => (
        <TableCell key={c.id} className={C_EARN}>
          {c.manual ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              value={e.cf[c.id] ?? ""}
              onChange={(ev) =>
                e.setCf((s) => ({ ...s, [c.id]: ev.target.value }))
              }
              className="ml-auto h-7 w-20 text-right tabular-nums"
            />
          ) : (
            fmt(slip.custom[c.id] ?? 0)
          )}
        </TableCell>
      ))}
      <TableCell className={C_TOTAL}>
        {fmt(round2(e.totalSalary + cs.earn))}
      </TableCell>
      <TableCell className={C_DED}>{fmt(slip.advanceOutstanding)}</TableCell>
      <TableCell className={C_DED}>{cell("advanceRecovered")}</TableCell>
      <TableCell className={C_DED}>{cell("absentDays", "0.5")}</TableCell>
      <TableCell className={C_DED}>{fmt(e.absenceDeduction)}</TableCell>
      {dedCustom.map((c) => (
        <TableCell key={c.id} className={C_DED}>
          {c.manual ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              value={e.cf[c.id] ?? ""}
              onChange={(ev) =>
                e.setCf((s) => ({ ...s, [c.id]: ev.target.value }))
              }
              className="ml-auto h-7 w-20 text-right tabular-nums"
            />
          ) : (
            fmt(slip.custom[c.id] ?? 0)
          )}
        </TableCell>
      ))}
      <TableCell className={C_NET}>
        {fmt(round2(e.payable + cs.earn - cs.ded))}
      </TableCell>
      <TableCell className={`${META} text-center`}>
        <PaidControl slip={slip} canEdit={canEdit} />
      </TableCell>
      <TableCell className={`${META} text-center`}>
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-success"
            onClick={e.save}
            disabled={e.pending}
            title="Save"
          >
            {e.pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={e.reset}
            disabled={e.pending}
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
