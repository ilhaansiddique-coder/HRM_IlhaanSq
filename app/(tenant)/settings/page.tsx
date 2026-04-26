import { requireTenant } from "@/lib/auth";
import {
  getCachedBusinessSettings,
  getCachedSystemSettings,
  getAllTenantPaymentMethods,
} from "@/lib/cache";
import { SettingsTabs } from "./_components/settings-tabs";

export default async function SettingsPage() {
  const session = await requireTenant();

  const [business, system, methods] = await Promise.all([
    getCachedBusinessSettings(session.tenantId),
    getCachedSystemSettings(session.tenantId),
    // Settings page reads fresh (no cache) so the admin always sees
    // the live state, including just-disabled methods that need to be
    // re-enabled. Cached read is for the sale form only.
    getAllTenantPaymentMethods(session.tenantId),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <SettingsTabs business={business} system={system} paymentMethods={methods} />
    </div>
  );
}
