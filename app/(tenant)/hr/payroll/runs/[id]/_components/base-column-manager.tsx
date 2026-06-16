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
import { Settings2, SquarePen, Loader2, Plus, X, RotateCcw } from "lucide-react";
import {
  setBaseColumnAction,
  clearBaseColumnAction,
} from "../../../../actions-phase2";
import type { MStep } from "./column-manager";

type Op = "multiply" | "add" | "subtract" | "divide";
type Field = { key: string; label: string };

export type BaseCol = {
  key: string;
  kind: "money" | "count";
  label: string;
  defaultLabel: string;
  shortLabel: string;
  group: "earning" | "deduction";
  defaultGroup: "earning" | "deduction";
  hidden: boolean;
  formula: MStep[];
  formulaText: string;
  overridden: boolean;
};

type StepStr = { v: string; op: Op; valueShown: boolean };

export function BaseColumnManager({
  columns,
  baseFields,
}: {
  columns: BaseCol[];
  baseFields: Field[];
}) {
  const SELECT = "h-9 rounded-md border border-base-300 bg-base-100 px-2 text-sm";
  const DLIST = "base-col-options";
  const opSym = (o: Op) =>
    o === "multiply" ? "×" : o === "add" ? "+" : o === "divide" ? "÷" : "−";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [group, setGroup] = useState<"earning" | "deduction">("earning");
  const [hidden, setHidden] = useState(false);
  const [steps, setSteps] = useState<StepStr[]>([]);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const keyToLabel = new Map(baseFields.map((f) => [f.key, f.label]));
  const labelToKey = new Map(
    baseFields.map((f) => [f.label.toLowerCase(), f.key])
  );

  function resetForm() {
    setEdit(null);
    setName("");
    setShortLabel("");
    setGroup("earning");
    setHidden(false);
    setSteps([]);
    setAck(false);
    setError(null);
  }

  function openEdit(c: BaseCol) {
    setError(null);
    setNotice(null);
    setEdit(c.key);
    setName(c.overridden && c.label !== c.defaultLabel ? c.label : "");
    setShortLabel(c.shortLabel !== c.defaultLabel ? c.shortLabel : "");
    setGroup(c.group);
    setHidden(c.hidden);
    setSteps(
      c.formula.map((s) => ({
        v: s.kind === "const" ? String(s.value) : keyToLabel.get(s.field) ?? s.field,
        op: s.op,
        valueShown: true,
      }))
    );
    setAck(false);
  }

  function addStep() {
    setSteps((s) => {
      if (s.length === 0) return [{ v: "", op: "add", valueShown: true }];
      const last = s[s.length - 1];
      if (last.valueShown)
        return [...s, { v: "", op: "add", valueShown: false }];
      return s.map((st, i) =>
        i === s.length - 1 ? { ...st, valueShown: true } : st
      );
    });
  }
  const setStep = (i: number, p: Partial<StepStr>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...p } : st)));
  const rmStep = (i: number) =>
    setSteps((s) => s.filter((_, idx) => idx !== i));

  function resolve(str: string) {
    const t = str.trim();
    if (!t) return null;
    const key =
      labelToKey.get(t.toLowerCase()) ??
      (baseFields.some((f) => f.key === t) ? t : undefined);
    if (key) return { kind: "field" as const, field: key };
    const n = Number(t);
    return Number.isFinite(n) ? { kind: "const" as const, value: n } : null;
  }

  const editingCol = columns.find((c) => c.key === edit) || null;
  const isCount = editingCol?.kind === "count";

  function save() {
    if (!editingCol) return;
    setError(null);
    setNotice(null);
    let formula: MStep[] = [];
    const usable = steps.filter((s) => s.valueShown && s.v.trim());
    for (const st of usable) {
      const o = resolve(st.v);
      if (!o) {
        setError("Each formula value must be a column name or a number.");
        return;
      }
      formula.push({ ...o, op: st.op } as MStep);
    }
    const fd = new FormData();
    fd.set("fieldKey", editingCol.key);
    fd.set("nameOverride", name);
    fd.set("shortLabelOverride", shortLabel);
    fd.set("hidden", hidden ? "true" : "false");
    if (!isCount) fd.set("groupOverride", group);
    fd.set("formula", usable.length ? JSON.stringify(formula) : "");
    start(async () => {
      const res = await setBaseColumnAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      resetForm();
      setNotice(res.info ?? "Saved.");
      router.refresh();
    });
  }

  function reset(c: BaseCol) {
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set("fieldKey", c.key);
    start(async () => {
      const res = await clearBaseColumnAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      if (edit === c.key) resetForm();
      setNotice(res.info ?? "Reset.");
      router.refresh();
    });
  }

  const preview =
    steps.length === 0
      ? "raw stored value"
      : steps
          .map((s, i) => {
            const v = s.valueShown ? s.v || "?" : "?";
            return i === 0 ? v : `${opSym(s.op)} ${v}`;
          })
          .join(" ");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          resetForm();
          setNotice(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Built-in Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit built-in salary-sheet columns</DialogTitle>
          <DialogDescription>
            Rename, hide, regroup, or override the calculation of built-in
            columns.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-base-content">
          <strong>Destructive:</strong> saving or resetting here recomputes and
          <strong> overwrites the stored payroll figures of every run for
          this organisation — including completed and already-paid runs.</strong>
        </div>

        <datalist id={DLIST}>
          {baseFields.map((f) => (
            <option key={f.key} value={f.label} />
          ))}
        </datalist>

        {/* Column list */}
        <div className="space-y-1.5">
          {columns.map((c) => (
            <div key={c.key}>
              <div
                className="flex items-center justify-between gap-2 rounded-md border border-base-300 px-2.5 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {c.label}
                    {c.hidden && (
                      <span className="ml-1.5 text-xs text-destructive">
                        (hidden)
                      </span>
                    )}
                    {c.overridden && !c.hidden && (
                      <span className="ml-1.5 text-xs text-primary">
                        (edited)
                      </span>
                    )}
                  </div>
                  <div className="break-words text-xs text-muted-foreground">
                    {c.group === "earning" ? "Earnings" : "Deductions"}
                    {c.kind === "count" ? " · day count" : ""}
                    {c.formulaText ? ` · = ${c.formulaText}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => openEdit(c)}
                    title="Edit"
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </Button>
                  {c.overridden && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-muted-foreground"
                      onClick={() => reset(c)}
                      disabled={pending}
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Edit form — renders inline below the row being edited */}
              {edit === c.key && (
                <div className="min-w-0 space-y-3 rounded-lg border border-primary/40 p-3 mt-1.5">
                  <div className="text-sm font-semibold">
                    Editing “{editingCol!.defaultLabel}”
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={editingCol!.defaultLabel}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={shortLabel}
                        onChange={(e) => setShortLabel(e.target.value)}
                        placeholder={editingCol!.defaultLabel}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Group</Label>
                      <select
                        className={`${SELECT} w-full ${isCount ? "opacity-50" : ""}`}
                        value={group}
                        disabled={isCount}
                        onChange={(e) =>
                          setGroup(e.target.value as "earning" | "deduction")
                        }
                      >
                        <option value="earning">Earnings ( + Total Salary )</option>
                        <option value="deduction">
                          Deductions ( − Net Payable )
                        </option>
                      </select>
                      {isCount && (
                        <p className="text-[11px] text-muted-foreground">
                          Day-count columns can&apos;t change group.
                        </p>
                      )}
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={hidden}
                        onChange={(e) => setHidden(e.target.checked)}
                      />
                      Hide / remove from sheet
                    </label>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label className="block text-xs">
                      Override calculation (leave empty to keep the raw stored value)
                    </Label>
                    {steps.length === 0 && (
                      <p className="rounded-md border border-dashed border-base-300 px-2.5 py-2 text-xs text-muted-foreground">
                        No formula — uses the raw stored value. Click “+ Add” to
                        redefine it.
                      </p>
                    )}
                    {steps.map((st, i) => (
                      <div
                        key={i}
                        className="grid min-w-0 items-center gap-1.5 [grid-template-columns:3rem_minmax(0,1fr)_1.75rem]"
                      >
                        {i === 0 ? (
                          <span className="text-center text-[11px] text-muted-foreground">
                            start
                          </span>
                        ) : (
                          <select
                            className={`${SELECT} w-full px-0 text-center`}
                            value={st.op}
                            onChange={(e) =>
                              setStep(i, { op: e.target.value as Op })
                            }
                            aria-label="operation"
                          >
                            <option value="multiply">×</option>
                            <option value="add">+</option>
                            <option value="subtract">−</option>
                            <option value="divide">÷</option>
                          </select>
                        )}
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
                            Click “+ Add” again to set this value
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-full text-muted-foreground"
                          onClick={() => rmStep(i)}
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
                        {steps.length === 0
                          ? "Add first value"
                          : !steps[steps.length - 1].valueShown
                          ? "Add value"
                          : "Add operator"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md bg-base-200/60 px-2.5 py-1.5 text-xs">
                    Value: <span className="font-medium">{preview}</span>
                  </div>

                  <label className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-2 text-xs text-base-content">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    I understand this immediately rewrites stored payroll for ALL
                    runs of this organisation, including completed and paid ones.
                  </label>

                  {error && (
                    <div className="text-xs text-destructive">{error}</div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={save}
                      disabled={pending || !ack}
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SquarePen className="h-4 w-4" />
                      )}
                      Save &amp; recompute
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {notice && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-base-content">
            {notice}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
