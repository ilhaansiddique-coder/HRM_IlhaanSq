import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireTenant } from "@/lib/auth";
import { checkRate, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function ensureAdminRole(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Forbidden");
  }
}

function ensureAdminRole(role: string | null) {
  if (!["owner", "admin", "admin"].includes(role ?? "")) {
    throw new Error("Forbidden");
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

    const bytes = Buffer.from(await file.arrayBuffer());
    const publicId = `rahedeen/${session.tenantId}/logo-${randomUUID()}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "rahedeen/logos",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(bytes);
    });

    if (!uploadResult || typeof uploadResult === 'string') {
      return jsonError("Could not save the logo. Please try again.", 500);
    }

    return NextResponse.json({
      url: (uploadResult as any).secure_url,
      path: publicId
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Forbidden") {
      return jsonError("Only admins can change the business logo.", 403);
    }
    console.error("[upload/business-logo] unhandled:", e);
    return jsonError("Upload failed.", 500);
  }
}
