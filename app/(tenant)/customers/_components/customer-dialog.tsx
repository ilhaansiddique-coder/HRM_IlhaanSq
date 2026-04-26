"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomerAction, updateCustomerAction } from "../actions";

type CustomerStatus = "active" | "neutral" | "inactive";

type CustomerInitial = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  status: string | null;
  creditLimit: number | string | null;
  additionalInfo: string | null;
};

const STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "neutral", label: "Neutral" },
  { value: "inactive", label: "Inactive" },
];

const normalizeStatus = (raw: string | null | undefined): CustomerStatus =>
  raw === "active" || raw === "neutral" ? raw : "inactive";

export function CustomerDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: CustomerInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Status lives in React state because shadcn's Select is controlled
  // and doesn't read defaultValue from the surrounding form.
  const [status, setStatus] = useState<CustomerStatus>(
    normalizeStatus(initial?.status)
  );
  const isEdit = !!initial;

  // Reset the form whenever the dialog reopens against a different
  // record (or in create mode after editing). Without this, switching
  // from "edit Alice" → close → "add" would leave Alice's status
  // selected in the new-customer form.
  useEffect(() => {
    if (!open) return;
    setStatus(normalizeStatus(initial?.status));
    setError(null);
  }, [open, initial]);

  function handleSubmit(formData: FormData) {
    setError(null);
    if (isEdit) formData.set("customerId", initial!.id);
    formData.set("status", status);
    startTransition(async () => {
      try {
        if (isEdit) await updateCustomerAction(formData);
        else await createCustomerAction(formData);
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEdit ? "Edit Customer" : "Add New Customer"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the customer's details."
              : "Enter the details for the new customer."}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Customer Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Customer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              placeholder="Enter customer name"
              defaultValue={initial?.name}
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="Enter phone number"
              defaultValue={initial?.phone ?? ""}
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={3}
              placeholder="Enter customer address"
              defaultValue={initial?.address ?? ""}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CustomerStatus)}
            >
              <SelectTrigger id="status" aria-label="Customer status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Info */}
          <div className="space-y-1.5">
            <Label htmlFor="additionalInfo">Additional Info</Label>
            <Input
              id="additionalInfo"
              name="additionalInfo"
              placeholder="Enter any additional information (e.g., VIP, Wholesale, Notes, etc.)"
              defaultValue={initial?.additionalInfo ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Enter any additional information or notes for this customer
            </p>
          </div>

          {/* Credit Limit */}
          <div className="space-y-1.5">
            <Label htmlFor="creditLimit">Credit Limit</Label>
            <Input
              id="creditLimit"
              name="creditLimit"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0"
              defaultValue={
                initial?.creditLimit != null
                  ? Number(initial.creditLimit)
                  : 0
              }
            />
            <p className="text-xs text-muted-foreground">
              Maximum credit amount allowed for this customer (0 = no credit)
            </p>
          </div>

          {/* Footer — full-width stacked on mobile, right-aligned on sm+ */}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
