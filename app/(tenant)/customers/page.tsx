import { requireTenant } from "@/lib/auth";
import { getCachedCustomers } from "@/lib/cache";
import { CustomerList } from "./_components/customer-list";

export default async function CustomersPage() {
  const session = await requireTenant();
  const customers = await getCachedCustomers(session.tenantId);

  return (
    <div className="space-y-4 md:space-y-6">
      <CustomerList initialCustomers={customers} />
    </div>
  );
}
