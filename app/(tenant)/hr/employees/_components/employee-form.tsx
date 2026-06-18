"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Copy, Check, KeyRound, UserCheck } from "lucide-react";
import { createEmployeeAction, updateEmployeeAction } from "../../actions";

// Readable temp-password generator (avoids ambiguous chars like 0/O, 1/l).
const PWD_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
function generateTempPassword() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "T" + Array.from(bytes, (b) => PWD_CHARS[b % PWD_CHARS.length]).join("");
}

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
  onClose,
}: {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; fullName: string; empCode: string }[];
  mode?: "create" | "edit";
  employeeId?: string;
  defaultValues?: EmployeeFormDefaults;
  // When rendered inside a dialog: close it (and refresh) instead of navigating.
  onClose?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPwd, setTempPwd] = useState("");
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    tempPassword: string | null;
    reused: boolean;
  } | null>(null);

  const dv = defaultValues ?? {};
  // Every field is required (except email) on both the create AND edit forms.
  const req = true;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "edit" && employeeId) {
          formData.set("id", employeeId);
          const res = await updateEmployeeAction(formData);
          if (!res.ok) {
            setError(res.error ?? "Failed to update employee");
            return;
          }
          if (onClose) onClose();
          else router.push("/hr/employees");
          return;
        }

        const res = await createEmployeeAction(formData);
        if (!res.ok) {
          setError(res.error ?? "Failed to create employee");
          return;
        }
        // If the admin set a temp password, stay on this screen and show the
        // login credentials to hand over instead of redirecting immediately.
        if (res.login) {
          setCreated(res.login);
          return;
        }
        if (onClose) onClose();
        else router.push("/hr/employees");
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : `Failed to ${mode === "edit" ? "update" : "create"} employee`
        );
      }
    });
  }

  if (created) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-success/40 bg-success/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <UserCheck className="h-4 w-4" />
            Employee created and login activated.
          </p>
          {created.tempPassword ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Give these to the employee. They&apos;ll be asked to set their own
                password the first time they sign in.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Email:</span>
                <code className="rounded bg-background/70 px-1.5 py-0.5">
                  {created.email}
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Temp password:</span>
                <code className="rounded bg-background/70 px-1.5 py-0.5 font-semibold">
                  {created.tempPassword}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${created.email} / ${created.tempPassword}`
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              An account already existed for{" "}
              <code className="rounded bg-background/70 px-1 py-0.5">
                {created.email}
              </code>
              , so the temporary password you set was not applied — they can sign
              in with their existing password.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else router.push("/hr/employees");
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
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
        <Field label="Email">
          <Input name="email" type="email" defaultValue={dv.email} />
        </Field>
        <Field label="Phone" required={req}>
          <Input name="phone" type="tel" required={req} defaultValue={dv.phone} />
        </Field>
        <Field label="Date of Birth" required={req}>
          <DatePicker
            name="dob"
            required={req}
            placeholder="Date of birth"
            yearNavigation
            fromYear={1940}
            defaultValue={dv.dob ? new Date(dv.dob).toISOString().slice(0, 10) : undefined}
          />
        </Field>
        <Field label="Gender" required={req}>
          <Select name="gender" defaultValue={dv.gender} required={req}>
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
        <Field label="National ID" required={req}>
          <Input name="nationalId" required={req} defaultValue={dv.nationalId} />
        </Field>
        <Field label="Address" full required={req}>
          <Textarea name="address" rows={2} required={req} defaultValue={dv.address} />
        </Field>
        <Field label="Emergency Contact" required={req}>
          <Input name="emergencyContact" required={req} placeholder="Contact name" defaultValue={dv.emergencyContact} />
        </Field>
        <Field label="Emergency Phone" required={req}>
          <Input name="emergencyPhone" type="tel" required={req} defaultValue={dv.emergencyPhone} />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Hire Date" required>
          <DatePicker
            name="hireDate"
            required
            placeholder="Hire date"
            yearNavigation
            fromYear={2000}
            showPresets
            defaultValue={
              dv.hireDate
                ? new Date(dv.hireDate).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10)
            }
          />
        </Field>
        <Field label="Employment Type" required={req}>
          <Select name="employmentType" defaultValue={dv.employmentType ?? "full_time"} required={req}>
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
        <Field label="Department" required={req}>
          <Select name="departmentId" defaultValue={dv.departmentId} required={req}>
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
        <Field label="Position" required={req}>
          <Select name="positionId" defaultValue={dv.positionId} required={req}>
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
        <Field label="Base Salary" required={req}>
          <Input
            name="baseSalary"
            type="number"
            step="0.01"
            min="0"
            required={req}
            defaultValue={dv.baseSalary}
          />
        </Field>
        <Field label="Currency" required={req}>
          <Input name="currency" required={req} defaultValue={dv.currency ?? "BDT"} />
        </Field>
      </Section>

      {mode === "create" && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Login Access
          </h3>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
            <Label className="text-xs">
              Temporary password <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                name="tempPassword"
                value={tempPwd}
                onChange={(e) => setTempPwd(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setTempPwd(generateTempPassword())}
                title="Generate a password"
              >
                <RefreshCw className="h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The employee can sign in immediately with their email and this
              password — they&apos;ll be required to choose their own password on
              first login. An email address is needed for them to sign in.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
        <Button
          type="button"
          variant="outline"
          onClick={() => (onClose ? onClose() : router.back())}
        >
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
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">{children}</div>
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
    <div className={`space-y-1.5 ${full ? "sm:col-span-2 md:col-span-3" : ""}`}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}
