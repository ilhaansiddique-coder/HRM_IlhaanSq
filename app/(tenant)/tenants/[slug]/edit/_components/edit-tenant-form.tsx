"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { updateTenantAction } from "../../../actions";

export function EditTenantForm({
  tenant,
}: {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    formData.set("tenantId", tenant.id);

    startTransition(async () => {
      try {
        await updateTenantAction(formData);
        setSuccess(true);
        setTimeout(() => router.push("/tenants"), 1000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update tenant");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">
          Tenant updated successfully. Redirecting...
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Business Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={tenant.name}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL Slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={tenant.slug}
            pattern="[a-z0-9-]*"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan">Billing Plan</Label>
          <Select name="plan" defaultValue={tenant.plan}>
            <SelectTrigger id="plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter (Free)</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-3 border-t border-border/60 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
