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

      <Card className="overflow-hidden">
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
