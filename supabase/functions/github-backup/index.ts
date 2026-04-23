import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface GithubBackupPayload {
  tenant_id?: string;
}

const toBase64 = (content: string): string => {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

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

    const body = (await req.json().catch(() => ({}))) as GithubBackupPayload;
    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);

    if (authContext.role !== "superadmin") {
      throw new Error("Unauthorized: superadmin required");
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN") ?? "";
    const githubRepo = Deno.env.get("GITHUB_BACKUP_REPO") ?? "";
    const githubBasePath = Deno.env.get("GITHUB_BACKUP_PATH") ?? "backups";
    if (!githubToken || !githubRepo) {
      throw new Error("Missing GitHub backup environment variables");
    }

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString();

    let tenantIds: string[] = [];
    if (body.tenant_id) {
      tenantIds = [body.tenant_id];
    } else {
      const { data: tenants, error: tenantsError } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("is_active", true);
      if (tenantsError) {
        throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
      }
      tenantIds = (tenants ?? []).map((t) => t.id);
    }

    const snapshot: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      since: sinceIso,
      tenant_ids: tenantIds,
      tenants: [] as unknown[],
    };

    for (const tenantId of tenantIds) {
      const [productsResult, customersResult, salesResult] = await Promise.all([
        supabaseAdmin.from("products").select("*").eq("tenant_id", tenantId),
        supabaseAdmin.from("customers").select("*").eq("tenant_id", tenantId),
        supabaseAdmin
          .from("sales")
          .select("*")
          .eq("tenant_id", tenantId)
          .gte("created_at", sinceIso),
      ]);

      if (productsResult.error || customersResult.error || salesResult.error) {
        throw new Error(
          `Failed to export tenant ${tenantId}: ${
            productsResult.error?.message ||
            customersResult.error?.message ||
            salesResult.error?.message
          }`,
        );
      }

      (snapshot.tenants as unknown[]).push({
        tenant_id: tenantId,
        products: productsResult.data ?? [],
        customers: customersResult.data ?? [],
        sales_last_90_days: salesResult.data ?? [],
      });
    }

    const fileName = `tenant-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filePath = `${githubBasePath.replace(/\/$/, "")}/${fileName}`;
    const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

    let existingSha: string | undefined;
    const existingResp = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (existingResp.ok) {
      const existingJson = await existingResp.json();
      existingSha = existingJson?.sha;
    }

    const backupContent = JSON.stringify(snapshot, null, 2);
    const createResp = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Automated tenant backup ${new Date().toISOString()}`,
        content: toBase64(backupContent),
        sha: existingSha,
      }),
    });

    if (!createResp.ok) {
      const errorBody = await createResp.text();
      throw new Error(`Failed to push backup to GitHub: ${errorBody}`);
    }

    const createJson = await createResp.json();
    const commitUrl = createJson?.commit?.html_url ?? createJson?.content?.html_url ?? "";

    await supabaseAdmin.from("audit_logs").insert({
      user_id: authContext.userId,
      action: "backup.github",
      resource: "backup",
      metadata: {
        tenant_ids: tenantIds,
        file_path: filePath,
        commit_url: commitUrl,
      },
    });

    return new Response(JSON.stringify({ success: true, commit_url: commitUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("github-backup error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
