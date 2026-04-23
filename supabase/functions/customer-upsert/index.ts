import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  ensureRolePermission,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface CustomerWriteData {
  name?: string;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  tags?: string[];
  status?: string;
  additional_info?: string | null;
  credit_limit?: number;
}

interface CustomerUpsertPayload {
  id?: string;
  data?: CustomerWriteData;
}

const canBypassPermissionCheck = (role: string | null) =>
  role === "superadmin" || role === "tenant_admin" || role === "admin";

const isSchemaCompatibilityError = (message: string) =>
  /credit_limit|schema cache|column/i.test(message);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: CustomerUpsertPayload = {};
    try {
      body = (await req.json()) as CustomerUpsertPayload;
    } catch {
      body = {};
    }

    const customerId = body.id?.trim();
    const customerData = body.data ?? {};

    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);

    const requiredPermission = customerId ? "customers.edit" : "customers.add";
    const isAllowed =
      canBypassPermissionCheck(authContext.role) ||
      (await ensureRolePermission(supabaseAdmin, authContext.role, requiredPermission, authContext.tenantId));

    if (!isAllowed) {
      throw new Error(`Unauthorized: ${requiredPermission} permission required`);
    }

    if (!customerId && !customerData.name?.trim()) {
      throw new Error("Customer name is required");
    }

    if (customerId) {
      const { data: existingCustomer, error: existingError } = await supabaseAdmin
        .from("customers")
        .select("id, tenant_id")
        .eq("id", customerId)
        .eq("tenant_id", authContext.tenantId)
        .maybeSingle();

      if (existingError || !existingCustomer) {
        throw new Error("Customer not found in your tenant");
      }

      let updatePayload: Record<string, unknown> = {
        ...customerData,
      };

      let { data: updatedCustomer, error: updateError } = await supabaseAdmin
        .from("customers")
        .update(updatePayload)
        .eq("id", customerId)
        .eq("tenant_id", authContext.tenantId)
        .select("id, name")
        .single();

      if (updateError && isSchemaCompatibilityError(updateError.message || "") && "credit_limit" in updatePayload) {
        const { credit_limit, ...fallbackPayload } = updatePayload;
        updatePayload = fallbackPayload;
        const retry = await supabaseAdmin
          .from("customers")
          .update(updatePayload)
          .eq("id", customerId)
          .eq("tenant_id", authContext.tenantId)
          .select("id, name")
          .single();
        updatedCustomer = retry.data;
        updateError = retry.error;
      }

      if (updateError) {
        throw new Error(`Failed to update customer: ${updateError.message}`);
      }

      const salesUpdate: Record<string, unknown> = {};
      if (typeof customerData.name === "string") salesUpdate.customer_name = customerData.name;
      if (typeof customerData.phone === "string" || customerData.phone === null) salesUpdate.customer_phone = customerData.phone;
      if (typeof customerData.whatsapp === "string" || customerData.whatsapp === null) salesUpdate.customer_whatsapp = customerData.whatsapp;
      if (typeof customerData.address === "string" || customerData.address === null) salesUpdate.customer_address = customerData.address;
      if (typeof customerData.additional_info === "string" || customerData.additional_info === null) salesUpdate.additional_info = customerData.additional_info;

      if (Object.keys(salesUpdate).length > 0) {
        const { error: salesError } = await supabaseAdmin
          .from("sales")
          .update(salesUpdate)
          .eq("customer_id", customerId)
          .eq("tenant_id", authContext.tenantId);

        if (salesError) {
          throw new Error(`Failed to sync customer details to sales: ${salesError.message}`);
        }
      }

      return new Response(JSON.stringify(updatedCustomer), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let insertPayload: Record<string, unknown> = {
      ...customerData,
      name: customerData.name?.trim(),
      created_by: authContext.userId,
      tenant_id: authContext.tenantId,
    };

    let { data: createdCustomer, error: createError } = await supabaseAdmin
      .from("customers")
      .insert(insertPayload)
      .select("id, name")
      .single();

    if (createError && isSchemaCompatibilityError(createError.message || "") && "credit_limit" in insertPayload) {
      const { credit_limit, ...fallbackPayload } = insertPayload;
      insertPayload = fallbackPayload;
      const retry = await supabaseAdmin
        .from("customers")
        .insert(insertPayload)
        .select("id, name")
        .single();
      createdCustomer = retry.data;
      createError = retry.error;
    }

    if (createError) {
      throw new Error(`Failed to create customer: ${createError.message}`);
    }

    return new Response(JSON.stringify(createdCustomer), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("customer-upsert error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
