"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, SquarePen, Trash2, Loader2, X, Save } from "lucide-react";
import {
  createPayrollColumnAction,
  updatePayrollColumnAction,
  deletePayrollColumnAction,
} from "../../../../actions-phase2";

type Op = "multiply" | "add" | "subtract" | "divide";
type MOperand =
  | { kind: "field"; field: string }
  | { kind: "const"; value: number };
export type MStep = MOperand & { op: Op };

export type ManagerCol = {
  id: string;
  name: string;
  shortLabel: string;
  group: "earning" | "deduction";
  formula: MStep[];
  formulaText: string;
  manual: boolean;
};

type Field = { key: string; label: string };
type StepStr = { v: string; op: Op; valueShown: boolean };

const SELECT = "h-9 rounded-md border border-base-300 bg-base-100 px-2 text-sm";
const DLIST = "payroll-col-options";
const opSym = (o: Op) =>
  o === "multiply" ? "×" : o === "add" ? "+" : o === "divide" ? "÷" : "−";

const blank = () => ({
  id: "",
  name: "",
  shortLabel: "",
  group: "earning" as "earning" | "deduction",
  manual: true, // new columns behave like "New" by default (per-employee entry)
  steps: [] as StepStr[],
});

export function ColumnManager({
  columns,
  baseFields,
}: {
  columns: ManagerCol[];
  baseFields: Field[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!form.id;

  const keyToLabel = new Map<string, string>(
    baseFields.map((f) => [f.key, f.label])
  );
  const labelToKey = new Map<string, string>(
    baseFields.map((f) => [f.label.toLowerCase(), f.key])
  );

  // A formula may also reference other custom columns. Exclude the column
  // being edited to avoid a self-reference.
  const refCols = columns.filter((c) => c.id !== form.id);
  for (const c of refCols) {
    keyToLabel.set(c.id, c.name);
    labelToKey.set(c.name.trim().toLowerCase(), c.id);
    if (c.shortLabel.trim())
      labelToKey.set(c.shortLabel.trim().toLowerCase(), c.id);
  }

  // Type an existing column's name or label → load its logic for editing.
  const existingByText = new Map<string, ManagerCol>();
  for (const c of columns) {
    existingByText.set(c.name.trim().toLowerCase(), c);
    existingByText.set(c.shortLabel.trim().toLowerCase(), c);
  }

  // Built-in salary fields (by label or key) — for duplicate-name warnings.
  const baseByText = new Map<string, string>();
  for (const f of baseFields) {
    baseByText.set(f.label.trim().toLowerCase(), f.label);
    baseByText.set(f.key.trim().toLowerCase(), f.label);
  }

  const opToStr = (o: MOperand) =>
    o.kind === "const" ? String(o.value) : keyToLabel.get(o.field) ?? o.field;

  function resolve(s: string): MOperand | null {
    const t = s.trim();
    if (!t) return null;
    const key =
      labelToKey.get(t.toLowerCase()) ??
      (baseFields.some((f) => f.key === t) ? t : undefined) ??
      (refCols.some((c) => c.id === t) ? t : undefined);
    if (key) return { kind: "field", field: key };
    const n = Number(t);
    return Number.isFinite(n) ? { kind: "const", value: n } : null;
  }

  function editCol(c: ManagerCol) {
    setError(null);
    setNotice(null);
    setForm({
      id: c.id,
      name: c.name,
      shortLabel: c.shortLabel,
      group: c.group,
      manual: c.manual,
      steps: c.formula.map((s) => ({
        v: opToStr(s),
        op: s.op,
        valueShown: true,
      })),
    });
  }

  function reset() {
    setForm(blank());
    setError(null);
    setNotice(null);
  }

  // "+ Add" adds the OPERATOR first (alone). Clicking again when the last
  // step has no value reveals its value field (a value is optional). A
  // column may be saved with no operator and no value at all.
  function addStep() {
    setForm((s) => {
      const last = s.steps[s.steps.length - 1];
      if (last && !last.valueShown) {
        return {
          ...s,
          steps: s.steps.map((st, idx) =>
            idx === s.steps.length - 1 ? { ...st, valueShown: true } : st
          ),
        };
      }
      return {
        ...s,
        steps: [...s.steps, { v: "", op: "add" as Op, valueShown: false }],
      };
    });
  }
  function setStep(i: number, patch: Partial<StepStr>) {
    setForm((s) => ({
      ...s,
      steps: s.steps.map((st, idx) =>
        idx === i ? { ...st, ...patch } : st
      ),
    }));
  }
  function removeStep(i: number) {
    setForm((s) => ({
      ...s,
      steps: s.steps.filter((_, idx) => idx !== i),
    }));
  }

  function submit() {
    setError(null);
    setNotice(null);
    const savedName = form.name.trim();
    const wasEditing = !!form.id;
    // A value is optional — operator-only / empty formulas save fine
    // (the column is a shell worth 0 until logic is added).
    const usable = form.steps.filter((s) => s.valueShown && s.v.trim());
    const steps: MStep[] = [];
    for (const st of usable) {
      const o = resolve(st.v);
      if (!o) {
        setError("Each value must be a column name or a number.");
        return;
      }
      steps.push({ ...o, op: st.op });
    }
    const fd = new FormData();
    if (form.id) fd.set("id", form.id);
    fd.set("name", form.name);
    fd.set("shortLabel", form.shortLabel);
    fd.set("group", form.group);
    fd.set("manual", form.manual ? "true" : "false");
    fd.set("formula", form.manual ? "[]" : JSON.stringify(steps));
    start(async () => {
      const res = form.id
        ? await updatePayrollColumnAction(fd)
        : await createPayrollColumnAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      reset();
      setNotice(
        `${wasEditing ? "Updated" : "Saved"} “${savedName}”. It now appears in the list above.`
      );
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await deletePayrollColumnAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      if (form.id === id) reset();
      router.refresh();
    });
  }

  const previewSteps = form.steps.filter((s) => s.valueShown && s.v.trim());
  const preview =
    previewSteps.length === 0
      ? "— no formula (value 0)"
      : previewSteps
          .map((s, i) =>
            i === 0 ? s.v : `${opSym(s.op)} ${s.v}`
          )
          .join(" ");

  // Live name-collision detection for the notification banner.
  const nameKey = form.name.trim().toLowerCase();
  const customHit = nameKey ? existingByText.get(nameKey) : undefined;
  const baseHit = !customHit && nameKey ? baseByText.get(nameKey) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Column
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Custom salary-sheet columns</DialogTitle>
          <DialogDescription>
            Build the value left-to-right (first value, then each operator with
            the next value). An <strong>Earnings</strong> column is added to
            Total Salary; a <strong>Deductions</strong> column is subtracted
            from Net Payable.
          </DialogDescription>
        </DialogHeader>

        <datalist id={DLIST}>
          {baseFields.map((f) => (
            <option key={f.key} value={f.label} />
          ))}
          {refCols.map((c) => (
            <option key={c.id} value={c.name}>
              custom column
            </option>
          ))}
        </datalist>

        {/* Existing columns */}
        {columns.length > 0 && (
          <div className="space-y-1.5">
            {columns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-base-300 px-2.5 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {c.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({c.shortLabel})
                    </span>
                  </div>
                  <div className="break-words text-xs text-muted-foreground">
                    {c.group === "earning"
                      ? "Earnings → +Total Salary"
                      : "Deductions → −Net Payable"}{" "}
                    · {c.formulaText}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => editCol(c)}
                    title="Edit"
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-destructive"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div className="min-w-0 space-y-3 rounded-lg border border-base-300 p-3">
          <div className="text-sm font-semibold">
            {editing ? "Edit column" : "New column"}
          </div>

          {/* Group — top */}
          <div className="space-y-1">
            <Label className="text-xs">Group</Label>
            <select
              className={`${SELECT} w-full`}
              value={form.group}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  group: e.target.value as "earning" | "deduction",
                }))
              }
            >
              <option value="earning">Earnings ( + Total Salary )</option>
              <option value="deduction">Deductions ( − Net Payable )</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!form.id) {
                    const hit = existingByText.get(val.trim().toLowerCase());
                    if (hit) {
                      editCol(hit);
                      return;
                    }
                  }
                  setForm((s) => ({ ...s, name: val }));
                }}
                placeholder="e.g. House Rent Bonus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={form.shortLabel}
                onChange={(e) =>
                  setForm((s) => ({ ...s, shortLabel: e.target.value }))
                }
                placeholder="e.g. H.R.Bonus"
              />
            </div>
          </div>

          {/* Name-collision notification */}
          {editing ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs text-base-content">
              Editing the existing column
              {form.name ? (
                <>
                  {" "}“<strong>{form.name}</strong>”
                </>
              ) : (
                ""
              )}{" "}
              — its saved logic is loaded below. Adjust the operators/values
              and <strong>Save changes</strong>, or press{" "}
              <strong>Cancel</strong> to start a new column.
            </div>
          ) : customHit ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs text-base-content">
              <span>
                “<strong>{customHit.name}</strong>” already exists as a custom
                column.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0"
                onClick={() => editCol(customHit)}
              >
                Load its logic
              </Button>
            </div>
          ) : baseHit ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-2 text-xs text-base-content">
              “<strong>{baseHit}</strong>” is a built-in salary column, not a
              custom one. You can use it inside the formula below, but a custom
              column needs a different, unique name.
            </div>
          ) : null}

          {/* Manual-entry toggle */}
          <label className="flex items-start gap-2 rounded-md border border-base-300 px-2.5 py-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={form.manual}
              onChange={(e) =>
                setForm((s) => ({ ...s, manual: e.target.checked }))
              }
            />
            <span>
              <strong>Manual entry</strong> — type a value for each employee on
              the salary sheet (no formula). Earnings still add to Total Salary;
              Deductions still subtract from Net Payable.
            </span>
          </label>

          {form.manual && (
            <p className="rounded-md border border-dashed border-base-300 px-2.5 py-2 text-xs text-muted-foreground">
              No formula needed. After saving, an editable cell appears for this
              column on each employee’s row — type their amount there.
            </p>
          )}

          {/* Formula steps */}
          <div className={form.manual ? "hidden" : "min-w-0 space-y-2"}>
            <Label className="block text-xs">
              Formula (optional) — “+ Add” adds an operator; add a value only
              if it operates with another column or number
            </Label>
            {form.steps.length === 0 && (
              <p className="rounded-md border border-dashed border-base-300 px-2.5 py-2 text-xs text-muted-foreground">
                No formula — the column saves with value 0. Click “+ Add” to
                start a formula, or just Save.
              </p>
            )}
            {form.steps.map((st, i) => (
              <div
                key={i}
                className="grid min-w-0 items-center gap-1.5 [grid-template-columns:3rem_minmax(0,1fr)_1.75rem]"
              >
                <select
                  className={`${SELECT} w-full px-0 text-center`}
                  value={st.op}
                  onChange={(e) => setStep(i, { op: e.target.value as Op })}
                  aria-label="operation"
                  title={
                    i === 0
                      ? "Operator vs. the next value (the column starts from this first value)"
                      : "Operator"
                  }
                >
                  <option value="multiply">×</option>
                  <option value="add">+</option>
                  <option value="subtract">−</option>
                  <option value="divide">÷</option>
                </select>
                {st.valueShown ? (
                  <Input
                    list={DLIST}
                    value={st.v}
                    onChange={(e) => setStep(i, { v: e.target.value })}
                    placeholder="column / number"
                    className="h-9 w-full min-w-0"
                    autoFocus
                  />
                ) : (
                  <span className="self-center text-xs text-muted-foreground">
                    operator only — click “+ Add” to add a value (optional)
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-full text-muted-foreground"
                  onClick={() => removeStep(i)}
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={addStep}
              >
                <Plus className="h-3.5 w-3.5" />{" "}
                {form.steps.length > 0 &&
                !form.steps[form.steps.length - 1].valueShown
                  ? "Add value"
                  : "Add operator"}
              </Button>
            </div>
          </div>

          {!form.manual && (
            <div className="rounded-md bg-base-200/60 px-2.5 py-1.5 text-xs">
              Preview: <span className="font-medium">{preview}</span>
            </div>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}
          {notice && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-base-content">
              {notice}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 gap-1.5"
              onClick={submit}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {pending
                ? "Saving…"
                : editing
                ? "Save changes"
                : "Save column"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={reset} disabled={pending}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
