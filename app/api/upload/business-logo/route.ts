import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireTenant } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRate, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BUCKET = "business-logos";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.getBucket(BUCKET);
    if (data) return;
    if (error && !/not.*found|does not exist/i.test(error.message)) {
      bucketReady = null;
      throw error;
    }
    const { error: createErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      bucketReady = null;
      throw createErr;
    }
  })();
  return bucketReady;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function ensureAdminRole(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Forbidden");
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireTenant();
    ensureAdminRole(session.role);

    const rate = await checkRate(
      "upload",
      `logo:${session.tenantId}:${clientIp(req)}`
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many uploads. Try again in ${rate.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      console.error("[upload/business-logo] formData parse failed:", e);
      return jsonError("Could not read upload form.", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);
    if (!ALLOWED_MIME.has(file.type)) {
      return jsonError("Unsupported image type. Use JPG, PNG, WebP, or SVG.", 400);
    }
    if (file.size > MAX_BYTES) return jsonError("Logo too large (max 2MB).", 400);

    try {
      await ensureBucket();
    } catch (e) {
      console.error("[upload/business-logo] ensureBucket failed:", e);
      return jsonError("Image storage is not available right now.", 500);
    }

    const ext = (file.name.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const path = `${session.tenantId}/${randomUUID()}.${ext || "bin"}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const admin = getSupabaseAdmin();
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadErr) {
      console.error("[upload/business-logo] upload failed:", uploadErr);
      return jsonError("Could not save the logo. Please try again.", 500);
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (e) {
    if (e instanceof Error && e.message === "Forbidden") {
      return jsonError("Only admins can change the business logo.", 403);
    }
    console.error("[upload/business-logo] unhandled:", e);
    return jsonError("Upload failed.", 500);
  }
}
