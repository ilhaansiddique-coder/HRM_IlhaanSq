import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireTenant } from "@/lib/auth";
import { checkRate, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const session = await requireTenant();

    const rate = await checkRate("upload", `upload:${session.tenantId}:${clientIp(req)}`);
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
      console.error("[upload/product-image] formData parse failed:", e);
      return jsonError("Could not read upload form.", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);
    if (!ALLOWED_MIME.has(file.type)) {
      return jsonError("Unsupported image type. Use JPG, PNG, WebP, or GIF.", 400);
    }
    if (file.size > MAX_BYTES) return jsonError("Image too large (max 5MB).", 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const publicId = `rahedeen/${session.tenantId}/product-${randomUUID()}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "rahedeen/products",
          resource_type: "auto",
          quality: "auto",
          fetch_format: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(bytes);
    });

    if (!uploadResult || typeof uploadResult === 'string') {
      return jsonError("Could not save the image. Please try again.", 500);
    }

    return NextResponse.json({
      url: (uploadResult as any).secure_url,
      path: publicId
    });
  } catch (e) {
    console.error("[upload/product-image] unhandled:", e);
    return jsonError("Upload failed.", 500);
  }
}
