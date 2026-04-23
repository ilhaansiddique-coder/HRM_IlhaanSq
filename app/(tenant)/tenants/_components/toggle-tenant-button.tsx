"use client";

import { Button } from "@/components/ui/button";
import { toggleTenantAction } from "../actions";

export function ToggleTenantButton({
  tenantId,
  isActive,
}: {
  tenantId: string;
  isActive: boolean;
}) {
  return (
    <form action={toggleTenantAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" variant={isActive ? "outline" : "default"} size="sm">
        {isActive ? "Disable" : "Enable"}
      </Button>
    </form>
  );
}
