// app/api/health/route.ts
// Used by CI/CD pipeline, nginx, and uptime monitors.
// Returns { status: "ok" } when app + DB are healthy.

import { NextResponse } from 'next/server';
import { createClient }  from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const start  = Date.now();
  const checks: Record<string, string> = {};
  const memoryWarnMb = Number(process.env.HEALTH_MEMORY_WARN_MB ?? 480);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

  // Check 1: Database reachable
  if (!supabaseUrl || !serviceRoleKey) {
    checks.database = 'fail: missing supabase health-check configuration';
  } else {
    try {
      const db = createClient(supabaseUrl, serviceRoleKey);
      const { error } = await db
        .from('tenants')
        .select('id')
        .limit(1)
        .maybeSingle();
      checks.database = error ? `fail: ${error.message}` : 'ok';
    } catch (error: unknown) {
      checks.database = `fail: ${getErrorMessage(error)}`;
    }
  }

  // Check 2: App process
  checks.app = 'ok';

  // Check 3: Memory
  const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  checks.memory = memMB < memoryWarnMb ? 'ok' : `warn: ${memMB}MB`;

  const allOk  = Object.values(checks).every(v => v === 'ok');
  const status = allOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      checks,
      uptime_s:    Math.round(process.uptime()),
      duration_ms: Date.now() - start,
      version:     process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      timestamp:   new Date().toISOString(),
    },
    {
      status:  allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, no-cache' },
    }
  );
}
