"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2 } from "lucide-react";
import { createCustomerAction, updateCustomerAction } from "../actions";

type CustomerInitial = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  creditLimit: number | string | null;
  additionalInfo: string | null;
};

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
  const isEdit = !!initial;

  function handleSubmit(formData: FormData) {
    setError(null);
    if (isEdit) formData.set("customerId", initial!.id);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update customer details" : "Create a new customer record"}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required minLength={2} defaultValue={initial?.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" type="tel" defaultValue={initial?.whatsapp ?? ""} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} defaultValue={initial?.address ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creditLimit">Credit Limit</Label>
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial?.creditLimit ? Number(initial.creditLimit) : ""}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="additionalInfo">Notes</Label>
              <Textarea id="additionalInfo" name="additionalInfo" rows={2} defaultValue={initial?.additionalInfo ?? ""} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
