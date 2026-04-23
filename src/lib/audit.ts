import { supabase } from "@/integrations/supabase/client";

export async function logAudit({
  action,
  resource,
  resourceId,
  metadata,
}: {
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("audit_logs").insert({
    action,
    resource,
    resource_id: resourceId,
    metadata,
  });
}
