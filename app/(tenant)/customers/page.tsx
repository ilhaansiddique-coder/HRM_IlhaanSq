import { requireTenant } from "@/lib/auth";
import { getCachedCustomers } from "@/lib/cache";
import { CustomerList } from "./_components/customer-list";

export default async function CustomersPage() {
  const session = await requireTenant();
  const customers = await getCachedCustomers(session.tenantId);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          {customers.length} customer{customers.length !== 1 ? "s" : ""}
        </p>
      </div>

      <CustomerList initialCustomers={customers} />
    </div>
  );
}
