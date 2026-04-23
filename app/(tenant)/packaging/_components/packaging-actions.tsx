"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, PackageCheck, Truck } from "lucide-react";
import { updateSaleStatusAction } from "../../sales/actions";

export function PackagingActions({
  saleId,
  orderStatus,
  courierStatus,
}: {
  saleId: string;
  orderStatus: string;
  courierStatus: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [showShip, setShowShip] = useState(false);

  function markPackaged() {
    const fd = new FormData();
    fd.set("saleId", saleId);
    fd.set("orderStatus", "packaged");
    startTransition(async () => {
      try {
        await updateSaleStatusAction(fd);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleShip(formData: FormData) {
    formData.set("saleId", saleId);
    formData.set("orderStatus", "shipped");
    formData.set("courierStatus", "pending");
    startTransition(async () => {
      try {
        await updateSaleStatusAction(formData);
        setShowShip(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <>
      <div className="flex gap-1 justify-end">
        {orderStatus !== "packaged" && orderStatus !== "shipped" && (
          <Button onClick={markPackaged} disabled={pending} size="sm" variant="outline">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackageCheck className="h-3 w-3" />}
            Pack
          </Button>
        )}
        {courierStatus === "not_sent" || !courierStatus ? (
          <Button onClick={() => setShowShip(true)} disabled={pending} size="sm">
            <Truck className="h-3 w-3" />
            Ship
          </Button>
        ) : null}
      </div>

      <Dialog open={showShip} onOpenChange={setShowShip}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ship order</DialogTitle>
            <DialogDescription>Hand off to courier</DialogDescription>
          </DialogHeader>
          <form action={handleShip} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Courier *</Label>
              <Select name="courierName" defaultValue="Steadfast">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Steadfast">Steadfast</SelectItem>
                  <SelectItem value="Pathao">Pathao</SelectItem>
                  <SelectItem value="Janani">Janani</SelectItem>
                  <SelectItem value="Sundorban">Sundorban</SelectItem>
                  <SelectItem value="RedX">RedX</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consignmentId" className="text-xs">Consignment ID</Label>
              <Input id="consignmentId" name="consignmentId" placeholder="Tracking number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnNumber" className="text-xs">CN Number</Label>
              <Input id="cnNumber" name="cnNumber" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowShip(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Ship Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
