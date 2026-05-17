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
import { createEmployeeAction } from "../../actions";

export function EmployeeForm({
  departments,
  positions,
  managers,
}: {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; fullName: string; empCode: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createEmployeeAction(formData);
        router.push("/hr/employees");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create employee");
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
          <Input name="fullName" required minLength={2} />
        </Field>
        <Field label="Email" required>
          <Input name="email" type="email" required />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" />
        </Field>
        <Field label="Date of Birth">
          <Input name="dob" type="date" />
        </Field>
        <Field label="Gender">
          <Select name="gender">
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
          <Input name="nationalId" />
        </Field>
        <Field label="Address" full>
          <Textarea name="address" rows={2} />
        </Field>
        <Field label="Emergency Contact">
          <Input name="emergencyContact" placeholder="Contact name" />
        </Field>
        <Field label="Emergency Phone">
          <Input name="emergencyPhone" type="tel" />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Hire Date" required>
          <Input
            name="hireDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field label="Employment Type">
          <Select name="employmentType" defaultValue="full_time">
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
          <Select name="departmentId">
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
          <Select name="positionId">
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
          <Select name="managerId">
            <SelectTrigger>
              <SelectValue placeholder="Select manager..." />
            </SelectTrigger>
            <SelectContent>
              {managers.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No employees yet
                </SelectItem>
              ) : (
                managers.map((m) => (
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
          <Input name="baseSalary" type="number" step="0.01" min="0" />
        </Field>
        <Field label="Currency">
          <Input name="currency" defaultValue="BDT" />
        </Field>
      </Section>

      <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Employee
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
