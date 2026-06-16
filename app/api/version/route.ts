import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/build-id";

// Always served fresh so clients can compare the running build id against the
// currently-deployed one.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: BUILD_ID },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
