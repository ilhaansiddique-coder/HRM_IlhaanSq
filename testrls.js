#!/usr/bin/env node
// scripts/test-rls.js
// Runs before every deploy to verify tenant isolation is intact.
// If any test fails → deploy is BLOCKED.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_A      = process.env.TEST_TENANT_A_ID;
const TENANT_B      = process.env.TEST_TENANT_B_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !TENANT_A || !TENANT_B) {
  console.warn('⚠️  RLS tests skipped — missing TEST_TENANT_A_ID / TEST_TENANT_B_ID env vars');
  console.warn('   Set these in GitHub Secrets to enable RLS isolation tests.');
  process.exit(0); // non-blocking if test tenants not configured
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

async function setTenant(tenantId) {
  // Sets app.tenant_id session variable to simulate being logged in as that tenant
  await db.rpc('set_config', {
    setting_name:  'app.tenant_id',
    new_value:     tenantId,
    is_local:      true,
  });
}

async function runTests() {
  console.log('');
  console.log('🔒 Running RLS Isolation Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Tenant A: ${TENANT_A}`);
  console.log(`  Tenant B: ${TENANT_B}`);
  console.log('');

  // ── Products ───────────────────────────────────────────
  await test('Tenant A cannot SELECT Tenant B products', async () => {
    await setTenant(TENANT_A);
    const { data } = await db.from('products').select('id').eq('tenant_id', TENANT_B);
    if (data && data.length > 0) throw new Error(`RLS BREACH: ${data.length} rows exposed`);
  });

  await test('Tenant A cannot INSERT into Tenant B products', async () => {
    await setTenant(TENANT_A);
    const { error } = await db.from('products').insert({
      tenant_id:  TENANT_B,
      name:       '__rls_test_injection__',
      unit_price: 0,
    });
    // We WANT an error here — success means breach
    if (!error) throw new Error('RLS BREACH: Insert into another tenant succeeded');
  });

  // ── Sales ──────────────────────────────────────────────
  await test('Tenant A cannot SELECT Tenant B sales', async () => {
    await setTenant(TENANT_A);
    const { data } = await db.from('sales').select('id').eq('tenant_id', TENANT_B);
    if (data && data.length > 0) throw new Error(`RLS BREACH: ${data.length} rows exposed`);
  });

  // ── Customers ──────────────────────────────────────────
  await test('Tenant A cannot SELECT Tenant B customers', async () => {
    await setTenant(TENANT_A);
    const { data } = await db.from('customers').select('id').eq('tenant_id', TENANT_B);
    if (data && data.length > 0) throw new Error(`RLS BREACH: ${data.length} rows exposed`);
  });

  // ── Employees ──────────────────────────────────────────
  await test('Tenant A cannot SELECT Tenant B employees', async () => {
    await setTenant(TENANT_A);
    const { data } = await db.from('employees').select('id').eq('tenant_id', TENANT_B);
    if (data && data.length > 0) throw new Error(`RLS BREACH: ${data.length} rows exposed`);
  });

  // ── Invoices ───────────────────────────────────────────
  await test('Tenant A cannot SELECT Tenant B invoices', async () => {
    await setTenant(TENANT_A);
    const { data } = await db.from('invoices').select('id').eq('tenant_id', TENANT_B);
    if (data && data.length > 0) throw new Error(`RLS BREACH: ${data.length} rows exposed`);
  });

  // ── Audit logs ─────────────────────────────────────────
  await test('Tenant A cannot SELECT Tenant B audit logs', async () => {
    await setTenant(TENANT_A);
    const { data } = await db.from('audit_logs').select('id').eq('tenant_id', TENANT_B);
    if (data && data.length > 0) throw new Error(`RLS BREACH: ${data.length} rows exposed`);
  });

  // ── Summary ────────────────────────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('');
    console.error('🚨 RLS BREACH DETECTED — DEPLOY BLOCKED');
    console.error('   Fix RLS policies before deploying!');
    process.exit(1);
  }

  console.log('');
  console.log('✅ All RLS tests passed — safe to deploy');
}

runTests().catch(err => {
  console.error('Test runner crashed:', err.message);
  process.exit(1);
});