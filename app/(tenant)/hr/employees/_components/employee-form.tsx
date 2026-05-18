"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createEmployeeAction, updateEmployeeAction } from "../../actions";

export type EmployeeFormDefaults = {
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  nationalId?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  hireDate?: string;
  employmentType?: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  baseSalary?: string;
  currency?: string;
};

export function EmployeeForm({
  departments,
  positions,
  managers,
  mode = "create",
  employeeId,
  defaultValues,
}: {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; fullName: string; empCode: string }[];
  mode?: "create" | "edit";
  employeeId?: string;
  defaultValues?: EmployeeFormDefaults;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dv = defaultValues ?? {};

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "edit" && employeeId) {
          formData.set("id", employeeId);
          await updateEmployeeAction(formData);
        } else {
          await createEmployeeAction(formData);
        }
        router.push("/hr/employees");
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : `Failed to ${mode === "edit" ? "update" : "create"} employee`
        );
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Section title="Personal Information">
        <Field label="Full Name" required>
          <Input name="fullName" required minLength={2} defaultValue={dv.fullName} />
        </Field>
        <Field label="Email" required>
          <Input name="email" type="email" required defaultValue={dv.email} />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={dv.phone} />
        </Field>
        <Field label="Date of Birth">
          <Input
            name="dob"
            type="date"
            defaultValue={dv.dob ? new Date(dv.dob).toISOString().slice(0, 10) : undefined}
          />
        </Field>
        <Field label="Gender">
          <Select name="gender" defaultValue={dv.gender}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="National ID">
          <Input name="nationalId" defaultValue={dv.nationalId} />
        </Field>
        <Field label="Address" full>
          <Textarea name="address" rows={2} defaultValue={dv.address} />
        </Field>
        <Field label="Emergency Contact">
          <Input name="emergencyContact" placeholder="Contact name" defaultValue={dv.emergencyContact} />
        </Field>
        <Field label="Emergency Phone">
          <Input name="emergencyPhone" type="tel" defaultValue={dv.emergencyPhone} />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Hire Date" required>
          <Input
            name="hireDate"
            type="date"
            required
            defaultValue={
              dv.hireDate
                ? new Date(dv.hireDate).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10)
            }
          />
        </Field>
        <Field label="Employment Type">
          <Select name="employmentType" defaultValue={dv.employmentType ?? "full_time"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
              <SelectItem value="freelance">Freelance</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Department">
          <Select name="departmentId" defaultValue={dv.departmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select department..." />
            </SelectTrigger>
            <SelectContent>
              {departments.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No departments yet
                </SelectItem>
              ) : (
                departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Position">
          <Select name="positionId" defaultValue={dv.positionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select position..." />
            </SelectTrigger>
            <SelectContent>
              {positions.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No positions yet
                </SelectItem>
              ) : (
                positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reports To">
          <Select name="managerId" defaultValue={dv.managerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select manager..." />
            </SelectTrigger>
            <SelectContent>
              {managers.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No employees yet
                </SelectItem>
              ) : (
                managers
                  .filter((m) => !employeeId || m.id !== employeeId)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName} ({m.empCode})
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Compensation">
        <Field label="Base Salary">
          <Input
            name="baseSalary"
            type="number"
            step="0.01"
            min="0"
            defaultValue={dv.baseSalary}
          />
        </Field>
        <Field label="Currency">
          <Input name="currency" defaultValue={dv.currency ?? "BDT"} />
        </Field>
      </Section>

      <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "edit" ? "Save Changes" : "Create Employee"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}
