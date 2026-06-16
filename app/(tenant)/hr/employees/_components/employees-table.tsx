"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  SquarePen,
  Eye,
  Printer,
  Copy,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/ui/data-table";
import { EmployeeForm, type EmployeeFormDefaults } from "./employee-form";
import { EmployeeProfileDialog } from "./employee-profile-dialog";
import { toast } from "@/lib/toast";
import { deleteEmployeeAction } from "../../actions";

export type EmployeeRow = {
  id: string;
  empCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  status: string;
  approvalStatus: string | null;
  hireDate: string; // ISO
  // Full form defaults so the row's pencil can open the edit dialog.
  form: EmployeeFormDefaults;
};

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  on_leave: "secondary",
  terminated: "destructive",
  suspended: "outline",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

// Open a clean, print-only window for a single employee record.
function printEmployee(e: EmployeeRow) {
  if (typeof window === "undefined") return;
  const rows: [string, string][] = [
    ["Code", e.empCode],
    ["Name", e.fullName],
    ["Email", e.email],
    ["Phone", e.phone ?? "—"],
    ["Department", e.department ?? "—"],
    ["Position", e.position ?? "—"],
    ["Status", e.status.replace("_", " ")],
    ["Hired", fmtDate(e.hireDate)],
  ];
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) {
    toast.error("Allow pop-ups to print this record.");
    return;
  }
  w.document.write(`<!doctype html><html><head><title>${e.fullName} — ${e.empCode}</title>
    <style>
      body{font-family:system-ui,sans-serif;margin:40px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      .sub{color:#666;margin:0 0 24px;font-size:13px}
      table{border-collapse:collapse;width:100%}
      td{padding:8px 4px;border-bottom:1px solid #eee;font-size:14px}
      td.k{color:#666;width:160px;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
    </style></head><body>
    <h1>${e.fullName}</h1><p class="sub">${e.empCode} · Employee record</p>
    <table>${rows
      .map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`)
      .join("")}</table>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
  w.document.close();
}

export function EmployeesTable({
  employees,
  departments,
  positions,
  managers,
}: {
  employees: EmployeeRow[];
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; fullName: string; empCode: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  function copyEmployee(e: EmployeeRow) {
    const text = [
      e.fullName,
      e.empCode,
      e.email,
      e.phone ?? "",
      e.department ?? "",
      e.position ?? "",
    ]
      .filter(Boolean)
      .join(" · ");
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Employee details copied"))
      .catch(() => toast.error("Could not copy to clipboard"));
  }

  function refreshRow() {
    startTransition(() => {
      router.refresh();
      toast.success("Refreshed");
    });
  }

  function removeEmployee(e: EmployeeRow) {
    if (
      !window.confirm(
        `Delete ${e.fullName} (${e.empCode})? This permanently removes the employee and all their records.`
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", e.id);
    startTransition(async () => {
      await deleteEmployeeAction(fd);
      toast.success("Employee deleted");
      router.refresh();
    });
  }

  const columns: Column<EmployeeRow>[] = [
    {
      key: "code",
      header: "Code",
      width: "8%",
      className: "font-mono text-xs whitespace-nowrap",
      cell: (e) => e.empCode,
    },
    {
      key: "name",
      header: "Name",
      width: "16%",
      className: "font-medium whitespace-nowrap",
      cell: (e) => (
        <button
          type="button"
          onClick={() => setProfileId(e.id)}
          className="text-left font-medium text-primary hover:underline"
          title="View employee details"
        >
          {e.fullName}
        </button>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      width: "20%",
      cell: (e) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span>{e.email}</span>
          </div>
          {e.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{e.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "dept",
      header: "Department",
      width: "12%",
      className: "text-sm whitespace-nowrap",
      cell: (e) =>
        e.department ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "pos",
      header: "Position",
      width: "15%",
      className: "text-sm whitespace-nowrap",
      cell: (e) =>
        e.position ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      cell: (e) =>
        e.approvalStatus === "pending" ? (
          <Badge variant="secondary" className="text-[10px]">
            Pending approval
          </Badge>
        ) : e.approvalStatus === "rejected" ? (
          <Badge variant="destructive" className="text-[10px]">
            Approval rejected
          </Badge>
        ) : (
          <Badge
            variant={statusVariants[e.status] ?? "outline"}
            className="capitalize"
          >
            {e.status.replace("_", " ")}
          </Badge>
        ),
    },
    {
      key: "hired",
      header: "Hired",
      width: "10%",
      className: "text-xs text-muted-foreground whitespace-nowrap",
      cell: (e) => fmtDate(e.hireDate),
    },
  ];

  // Every row carries the full icon set (matches the reference design).
  const rowActions = (): RowAction<EmployeeRow>[] => [
    {
      key: "view",
      label: "View employee",
      icon: <Eye className="h-3.5 w-3.5" />,
      onClick: (e) => setProfileId(e.id),
    },
    {
      key: "edit",
      label: "Edit employee",
      icon: <SquarePen className="h-3.5 w-3.5" />,
      onClick: (e) => setEditing(e),
    },
    {
      key: "print",
      label: "Print record",
      icon: <Printer className="h-3.5 w-3.5" />,
      onClick: (e) => printEmployee(e),
    },
    {
      key: "copy",
      label: "Copy details",
      icon: <Copy className="h-3.5 w-3.5" />,
      onClick: (e) => copyEmployee(e),
    },
    {
      key: "refresh",
      label: "Refresh",
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      onClick: () => refreshRow(),
    },
    {
      key: "delete",
      label: "Delete employee",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      variant: "destructive",
      onClick: (e) => removeEmployee(e),
    },
  ];

  return (
    <>
      <DataTable
        rows={employees}
        columns={columns}
        getId={(e) => e.id}
        rowActions={rowActions}
        itemNoun="employees"
        actionsWidth="15rem"
        tableMinWidth="1180px"
        onBulkDelete={async (ids) => {
          await Promise.all(
            ids.map((id) => {
              const fd = new FormData();
              fd.set("id", id);
              return deleteEmployeeAction(fd);
            })
          );
        }}
      />

      {/* Full "at a glance" profile — opens from the name link and the eye
          icon; lazy-loads all the employee's HR data. */}
      <EmployeeProfileDialog
        employeeId={profileId}
        onClose={() => setProfileId(null)}
      />

      {/* Edit form in a dialog (the pencil icon) — same form the edit page
          uses, but opens inline instead of navigating. */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="h-[780px] max-h-[90vh] w-[1150px] max-w-[95vw] overflow-y-auto">
          {/* Neutralize DialogHeader's extra padding/border so the title sits
              at the same inset as the form — equal gap on all four sides. */}
          <DialogHeader className="border-0 bg-transparent p-0 text-left backdrop-blur-none md:p-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Edit Employee
            </DialogTitle>
            <DialogDescription>
              {editing ? `${editing.fullName} · ${editing.empCode}` : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EmployeeForm
              mode="edit"
              employeeId={editing.id}
              defaultValues={editing.form}
              departments={departments}
              positions={positions}
              managers={managers}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
