import { requireTenant } from "@/lib/auth";
import { tenantDb } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageOpen, CheckCircle2 } from "lucide-react";
import { PackagingActions } from "./_components/packaging-actions";

export default async function PackagingPage() {
  const session = await requireTenant();
  const db = tenantDb(session.tenantId);

  const pendingOrders = await db.sale.findMany({
    where: {
      isDeleted: false,
      OR: [
        { courierStatus: "not_sent" },
        { courierStatus: null },
        { orderStatus: "pending" },
      ],
      paymentStatus: { not: "cancelled" },
    },
    include: {
      items: { include: { product: true, variant: true } },
      customer: true,
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const totalItems = pendingOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Packaging</h1>
        <p className="text-sm text-muted-foreground">
          Orders waiting to be packaged and shipped
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{pendingOrders.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Items to Pack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalItems}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Packaging Queue</CardTitle>
          <CardDescription>Oldest orders first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
              <p className="text-sm font-medium">All orders packaged</p>
              <p className="text-xs text-muted-foreground">Nothing waiting to be shipped</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Order Status</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs font-medium">{o.invoiceNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{o.customerName}</p>
                          {o.customerPhone && (
                            <p className="text-xs text-muted-foreground">{o.customerPhone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          {o.items.slice(0, 3).map((i) => (
                            <div key={i.id}>
                              <span className="font-medium">{i.quantity}×</span> {i.product?.name ?? "Item"}
                            </div>
                          ))}
                          {o.items.length > 3 && (
                            <span className="text-muted-foreground">+{o.items.length - 3} more</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-xs text-muted-foreground truncate">
                          {o.customerAddress ?? "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{o.orderStatus}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{o.courierStatus ?? "not_sent"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <PackagingActions
                          saleId={o.id}
                          orderStatus={o.orderStatus}
                          courierStatus={o.courierStatus}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
