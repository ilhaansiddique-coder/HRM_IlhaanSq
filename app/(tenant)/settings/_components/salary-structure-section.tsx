// Salary Structure UI — moved out of /hr/payroll into the Settings page as a
// tab. It reuses the existing structure components (edit/new/standard/table) in
// place, so all functions and logic are preserved; only the host page changed.

import { requireTenant } from "@/lib/auth";
import { listSalaryStructures } from "@/lib/services/hr/payroll.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus } from "lucide-react";
import { EditStructureDialog } from "../../hr/payroll/structures/_components/edit-structure-dialog";
import { NewStructureForm } from "../../hr/payroll/structures/_components/new-structure-form";
import { StandardStructureButton } from "../../hr/payroll/structures/_components/standard-structure-button";
import { ComponentsTable } from "../../hr/payroll/structures/_components/components-table";

export async function SalaryStructureSection() {
  const session = await requireTenant();
  const structures = await listSalaryStructures(session.tenantId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5 text-primary" />
          Salary Structure
        </h2>
        <p className="text-sm text-muted-foreground">
          The salary structure the salary sheet is calculated from — existing
          structures are listed below.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {structures.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No salary structures yet. Create one to start.</p>
              </CardContent>
            </Card>
          ) : (
            structures.map((s) => (
              <Card key={s.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <CardDescription>
                        {s.components.length} component{s.components.length !== 1 ? "s" : ""} · {s._count.assignments} salary record{s._count.assignments !== 1 ? "s" : ""}
                      </CardDescription>
                      {s.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Badge variant={s.isActive ? "default" : "secondary"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <EditStructureDialog
                        id={s.id}
                        name={s.name}
                        description={s.description}
                        isActive={s.isActive}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ComponentsTable
                    structureId={s.id}
                    components={s.components.map((c) => ({
                      id: c.id,
                      name: c.name,
                      code: c.code,
                      type: c.type,
                      calculationType: c.calculationType,
                      value: Number(c.value),
                    }))}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />New Salary Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <NewStructureForm />

            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="text-xs text-muted-foreground mb-2">
                Or start from the HRM_IlhaanSq template — Basic + House Rent + Health
                + Education + Savings (Gross), plus D.H. Expenses paid on top.
              </p>
              <StandardStructureButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
