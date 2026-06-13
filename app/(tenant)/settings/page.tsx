import { requireTenant } from "@/lib/auth";
import {
  getCachedBusinessSettings,
  getCachedSystemSettings,
} from "@/lib/cache";
import { SettingsTabs } from "./_components/settings-tabs";
import { SalaryStructureSection } from "./_components/salary-structure-section";

export default async function SettingsPage() {
  const session = await requireTenant();

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
      />
    </div>
  );
}
