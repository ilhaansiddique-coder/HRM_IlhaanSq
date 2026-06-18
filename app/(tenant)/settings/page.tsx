import { requireTenant } from "@/lib/auth";
import {
  getCachedBusinessSettings,
  getCachedSystemSettings,
} from "@/lib/cache";
import { SettingsTabs } from "./_components/settings-tabs";
import { SalaryStructureSection } from "./_components/salary-structure-section";
import { BreakPenaltiesSection } from "./_components/break-penalties-section";
import { LeaveTypesSection } from "./_components/leave-types-section";
import { AdvancesSection } from "./_components/advances-section";
import { AssignSalarySection } from "./_components/assign-salary-section";
import { HolidaysSection } from "./_components/holidays-section";

export default async function SettingsPage() {
  const session = await requireTenant();
  const isAdmin = ["owner", "admin", "superadmin"].includes(
    session.role ?? ""
  );

  const [business, system] = await Promise.all([
    getCachedBusinessSettings(session.tenantId),
    getCachedSystemSettings(session.tenantId),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <SettingsTabs
        business={business}
        system={system}
        salaryStructure={<SalaryStructureSection />}
        breakPenalties={isAdmin ? <BreakPenaltiesSection /> : undefined}
        leaveTypes={isAdmin ? <LeaveTypesSection /> : undefined}
        advances={isAdmin ? <AdvancesSection /> : undefined}
        assignSalary={isAdmin ? <AssignSalarySection /> : undefined}
        holidays={isAdmin ? <HolidaysSection /> : undefined}
      />
    </div>
  );
}
