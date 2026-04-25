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

      {/* Desktop: table view. Mobile uses the card stack below. */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
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

      {/* Mobile: same data as a card stack — customer + invoice header,
          full item list, address, status badges, then PackagingActions
          at the foot. No horizontal scroll, no truncation. */}
      <div className="md:hidden space-y-3">
        {pendingOrders.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm font-medium">All orders packaged</p>
            <p className="text-xs">Nothing waiting to be shipped</p>
          </Card>
        ) : (
          pendingOrders.map((o) => (
            <Card key={o.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{o.customerName}</p>
                  {o.customerPhone && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.customerPhone}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {o.invoiceNumber}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="rounded-lg text-xs">
                    {o.orderStatus}
                  </Badge>
                  <Badge variant="outline" className="rounded-lg text-xs">
                    {o.courierStatus ?? "not_sent"}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Items:</span>
                  <div className="mt-1 space-y-0.5">
                    {o.items.slice(0, 3).map((i) => (
                      <div key={i.id}>
                        <span className="font-medium">{i.quantity}×</span>{" "}
                        {i.product?.name ?? "Item"}
                      </div>
                    ))}
                    {o.items.length > 3 && (
                      <span className="text-muted-foreground">
                        +{o.items.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Address: </span>
                  <span className="break-words">{o.customerAddress ?? "-"}</span>
                </div>
              </div>

              <div className="mt-3">
                <PackagingActions
                  saleId={o.id}
                  orderStatus={o.orderStatus}
                  courierStatus={o.courierStatus}
                />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
