import { requireTenant } from "@/lib/auth";
import {
  listBreakPenalties,
  listBreakSessions,
  getBreakTimeThreshold,
} from "@/lib/services/hr/break.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { AddPenaltyDialog } from "../../hr/break/_components/add-penalty-dialog";
import { PenaltyList } from "../../hr/break/_components/penalty-list";

// Break Penalties management, surfaced as a System Settings section. Admins
// review pending/applied/waived penalties and add new ones (the "+" portals
// into the top bar while this section is mounted).
export async function BreakPenaltiesSection() {
  const session = await requireTenant();

  const [penalties, sessions, employees, threshold] = await Promise.all([
    listBreakPenalties(session.tenantId),
    listBreakSessions(session.tenantId, {}),
    listEmployees(session.tenantId, { status: "active" }),
    getBreakTimeThreshold(session.tenantId),
  ]);

  return (
    <>
      <AddPenaltyDialog
        employees={employees.map((e) => ({
          id: e.id,
          name: e.fullName,
          code: e.empCode,
        }))}
        breakSessions={sessions.map((s) => ({
          id: s.id,
          employeeId: s.employeeId,
          breakStart: s.breakStart.toISOString(),
          durationMin: s.durationMin,
        }))}
        thresholdMin={threshold}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Break Penalties
          </CardTitle>
          <CardDescription>All penalty records</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending ({penalties.filter((p) => p.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="applied">
                Applied ({penalties.filter((p) => p.status === "applied").length})
              </TabsTrigger>
              <TabsTrigger value="waived">
                Waived ({penalties.filter((p) => p.status === "waived").length})
              </TabsTrigger>
            </TabsList>
            {(["pending", "applied", "waived"] as const).map((status) => (
              <TabsContent key={status} value={status} className="mt-4">
                <PenaltyList
                  penalties={
                    penalties
                      .filter((p) => p.status === status)
                      .map((p) => ({
                        ...p,
                        amount: Number(p.amount),
                      })) as any
                  }
                  isAdmin={true}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
