"use client";

import { useState } from "react";
import { useCurrency } from "../../_components/providers";
import { Search, Plus, Users, Pencil, Trash2 } from "lucide-react";
import type { Customer } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerDialog } from "./customer-dialog";
import { deleteCustomerAction } from "../actions";

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  neutral: "secondary",
  inactive: "outline",
};

export function CustomerList({
  initialCustomers,
}: {
  initialCustomers: Customer[];
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const { formatAmount } = useCurrency();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setDialogOpen(true);
  }

  const filtered = initialCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Desktop: table view. Mobile uses the card stack below. */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.phone ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {customer.email ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[customer.status] ?? "outline"}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {customer.orderCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(Number(customer.totalSpent))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(customer)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <form action={deleteCustomerAction}>
                          <input type="hidden" name="customerId" value={customer.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile: same data as a card stack — name + status header, two-col
          grid for phone/email/orders/total, edit + delete actions at foot. */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Users className="h-8 w-8 opacity-40" />
            <span className="text-sm">No customers found</span>
          </Card>
        ) : (
          filtered.map((customer) => (
            <Card key={customer.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{customer.name}</p>
                </div>
                <Badge
                  variant={statusVariants[customer.status] ?? "outline"}
                  className="rounded-lg"
                >
                  {customer.status}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {customer.phone && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="col-span-2 break-all">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium">{customer.email}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Orders: </span>
                  <span className="font-semibold">{customer.orderCount}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold">
                    {formatAmount(Number(customer.totalSpent))}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => openEdit(customer)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <form action={deleteCustomerAction} className="flex-1">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                phone: editing.phone,
                email: editing.email,
                address: editing.address,
                whatsapp: editing.whatsapp,
                creditLimit: editing.creditLimit ? Number(editing.creditLimit) : null,
                additionalInfo: editing.additionalInfo,
              }
            : undefined
        }
      />
    </div>
  );
}
