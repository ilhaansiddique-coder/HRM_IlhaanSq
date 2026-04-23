import { requireTenant } from "@/lib/auth";
import {
  getCachedBusinessSettings,
  getCachedSystemSettings,
  getCachedPaymentMethods,
} from "@/lib/cache";
import { SettingsTabs } from "./_components/settings-tabs";

export default async function SettingsPage() {
  const session = await requireTenant();

  const [business, system, methods] = await Promise.all([
    getCachedBusinessSettings(session.tenantId),
    getCachedSystemSettings(session.tenantId),
    getCachedPaymentMethods(session.tenantId),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <SettingsTabs business={business} system={system} paymentMethods={methods} />
    </div>
  );
}
