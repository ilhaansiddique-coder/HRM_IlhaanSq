import { requireTenant } from "@/lib/auth";
import { tenantDb } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Clock, DollarSign, CheckCircle2, Package } from "lucide-react";
import Link from "next/link";

export default async function AlertsPage() {
  const session = await requireTenant();
  const db = tenantDb(session.tenantId);

  const [lowStock, pendingOrders, unpaidSales] = await Promise.all([
    db.product.findMany({
      where: { isDeleted: false, stockQuantity: { lte: 10 } },
      orderBy: { stockQuantity: "asc" },
      take: 50,
    }),
    db.sale.findMany({
      where: { isDeleted: false, orderStatus: "pending" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.sale.findMany({
      where: { isDeleted: false, paymentStatus: { in: ["pending", "partial"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalAlerts = lowStock.length + pendingOrders.length + unpaidSales.length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Low stock — desktop: table view. Mobile uses the card stack below. */}
      <Card className="hidden md:block border-warning/35 bg-card/80 rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Low Stock Products
              </CardTitle>
              <CardDescription>{lowStock.length} below threshold</CardDescription>
            </div>
            <Link href="/inventory">
              <Button variant="ghost" size="sm">View Inventory</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lowStock.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All products well-stocked</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.sku ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">{p.stockQuantity}</TableCell>
                    <TableCell>
                      {p.stockQuantity <= 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : (
                        <Badge variant="secondary">Low</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile: low-stock card stack — name + status header, SKU + stock
          row below. No horizontal scroll, no truncation. */}
      <div className="md:hidden space-y-3">
        <Card className="border-warning/35 bg-card/80 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Low Stock Products
              </p>
              <p className="text-xs text-muted-foreground">
                {lowStock.length} below threshold
              </p>
            </div>
            <Link href="/inventory">
              <Button variant="ghost" size="sm">View</Button>
            </Link>
          </div>
        </Card>

        {lowStock.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <span className="text-sm">All products well-stocked</span>
          </Card>
        ) : (
          lowStock.map((p) => (
            <Card key={p.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.sku ?? "-"}
                  </p>
                </div>
                {p.stockQuantity <= 0 ? (
                  <Badge variant="destructive" className="rounded-lg">
                    Out of Stock
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-lg">
                    Low
                  </Badge>
                )}
              </div>
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">In Stock: </span>
                <span className="font-semibold">{p.stockQuantity}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending orders */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              Pending Orders
            </CardTitle>
            <CardDescription>{pendingOrders.length} orders awaiting action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No pending orders</p>
              </div>
            ) : (
              pendingOrders.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.customerName}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{s.orderStatus}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Unpaid sales */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5 text-primary" />
              Unpaid Sales
            </CardTitle>
            <CardDescription>{unpaidSales.length} with outstanding balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unpaidSales.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">All sales paid</p>
              </div>
            ) : (
              unpaidSales.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.customerName}</p>
                  </div>
                  <Badge variant={s.paymentStatus === "partial" ? "secondary" : "outline"} className="text-xs">
                    {s.paymentStatus}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
