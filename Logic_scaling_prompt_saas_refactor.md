# CODEX TASK — SaaS Business Logic Alignment

> **Role:** Senior full-stack SaaS engineer and product systems architect.
> **Mode:** Agentic. Work directly in the repository. Produce concrete code diffs.
> **Constraint:** Do NOT redesign architecture or business rules unless explicitly instructed.

---

## REPOSITORY CONTEXT

### Target Files
| File | Purpose |
|------|---------|
| `src/pages/Sales.tsx` | Sales creation UI and submission logic |
| `src/hooks/useDashboard.tsx` | Dashboard metric calculations |
| `src/pages/Reports.tsx` | Revenue and order reporting |
| `src/hooks/useCustomers.tsx` | Customer analytics and status |
| `src/hooks/useCustomerPayments.tsx` | Payment posting and allocation |
| `src/components/BaseSaleDialog.tsx` | Sale form validation and defaults |
| `supabase/migrations/20260120_initial_schema.sql` | DB schema and triggers |

### Stack
- React · TypeScript · Supabase · PostgreSQL · Tailwind · Hooks architecture

---

## EXECUTION PHASES

Execute in order. Do not skip phases. Confirm completion of each phase before proceeding.

---

## PHASE 1 — ANALYSIS (Read-only)

Produce a written summary of:

1. Current behavior vs. required behavior for each module
2. All inconsistencies (especially Dashboard vs. Reports divergence)
3. Complete list of files that will be modified or created

**Do not write any code in this phase.**

---

## PHASE 2 — ARCHITECTURE

Before writing code:

1. Design the shared rule layer at `src/lib/businessRules/`
2. Propose any schema additions (columns, triggers, indexes)
3. Explain downstream impact on all consuming modules

### Required Shared Utilities

Create these named exports — all other modules must import from here:

```ts
// src/lib/businessRules/index.ts

isSaleValidForRevenue(sale): boolean
isSaleCountableInUnitsSold(sale): boolean
isSaleExcludedFromCustomerDue(sale): boolean
getSaleRevenueContribution(sale): number
applyCourierStatusBusinessRule(sale, newStatus): SaleUpdate
calculateCustomerOutstandingBalance(customer, sales): BalanceSplit
shouldRestoreInventory(oldStatus, newStatus): boolean
shouldDeductInventory(oldStatus, newStatus): boolean
```

### TypeScript Types Required

```ts
type CourierStatus =
  | 'not_sent' | 'pending' | 'in_review' | 'sent'
  | 'in_transit' | 'delivery_ready' | 'out_for_delivery'
  | 'delivered' | 'payout_ready' | 'cancelled' | 'returned' | 'lost'

type PaymentStatus = 'paid' | 'partial' | 'pending' | 'cancelled'
type PaymentTerms  = 'cod' | 'credit' | 'prepaid' | 'mixed'
type StockAction   = 'deduct' | 'restore' | 'none'
```

---

## PHASE 3 — IMPLEMENTATION

### 3.1 — Sales Creation (`BaseSaleDialog.tsx`, `Sales.tsx`)

Enforce at submission time:

| Condition | Rule |
|-----------|------|
| `sale.items.length === 0` | Block submission |
| `customer_name` missing | Block submission |
| No delivery option or courier | Block submission |
| Unpaid balance exists | Auto-set `payment_terms = 'cod'` |
| Credit explicitly selected | Set `payment_terms = 'credit'` |
| Credit sale, no `due_date` | Auto-set `due_date = sale_date + 30 days` |
| Multiple payment splits | Set `payment_method = 'mixed'` |

---

### 3.2 — Revenue Rules (shared utility)

```
isSaleValidForRevenue(sale):
  RETURN false if courier_status IN [cancelled, returned, lost]
  RETURN false if payment_status === 'cancelled'
  RETURN true otherwise

getSaleRevenueContribution(sale):
  IF sale is partial payment:
    RETURN amount_paid - fee
  RETURN grand_total - fee
```

---

### 3.3 — Dashboard (`useDashboard.tsx`)

Refactor to use shared utilities. All metrics must align with report logic.

| Metric | Rule |
|--------|------|
| Revenue | `getSaleRevenueContribution` · valid sales only |
| Units Sold | Exclude `cancelled`, `returned`, `lost`, `payment_status=cancelled` |
| COD Due | `payment_terms=cod` AND `courier_status != delivered` |
| Credit Due | `payment_terms=credit` · `net_total - amount_paid` |
| Low Stock | Non-variant products only (preserve current behavior, document it) |

> **Document explicitly** any dashboard metric that intentionally differs from reports.

---

### 3.4 — Courier Status Effects (`applyCourierStatusBusinessRule`)

Implement this decision table exactly:

| New Status | Payment Status | Amount Paid | Amount Due | Inventory |
|------------|---------------|-------------|------------|-----------|
| `delivered` (non-credit) | `paid` | += remaining due | `0` | No change |
| `delivered` (credit) | `pending` (unchanged) | Unchanged | Unchanged | No change |
| `payout_ready` | Same as `delivered` (non-credit) | Same | Same | No change |
| `cancelled` | `cancelled` | `0` | `0` | **Restore** |
| `returned` | `cancelled` | `0` | `0` | **Restore** |
| `lost` | `cancelled` | `0` | `0` | **Do NOT restore** |
| All other statuses | Restore from backup or set pending | — | — | No change |

**Credit sale override is mandatory:**
- When `courier_status → delivered` AND `payment_terms = credit`:
  - Do NOT auto-set `payment_status = paid`
  - Do NOT modify `amount_paid`
  - Preserve `amount_due`

**Backward compatibility:**
- Always keep `order_status = courier_status`

**Status normalization map:**

| Raw Value | Normalized |
|-----------|-----------|
| blank / unknown | `not_sent` |
| `picked_up` | `in_transit` |
| `ready_for_delivery` | `delivery_ready` |
| `completed` | `delivered` |
| `pickup_cancelled` | `cancelled` |

---

### 3.5 — Customer Logic (`useCustomers.tsx`)

| Metric | Rule |
|--------|------|
| `active` | Last valid sale < 30 days ago |
| `neutral` | Last valid sale < 90 days ago |
| `inactive` | Otherwise |
| Valid sale | Excludes `cancelled`, `returned`, `lost` |
| `delivered_count` | `courier_status === delivered` |
| `cancelled_count` | `cancelled` + `returned` + `lost` |
| `pending_count` | All other statuses |
| `total_spent` | Delivered orders only · `grand_total - fee` |
| `outstanding_balance` | `credit_due + normal_due` · excludes cancelled/returned/lost |

---

### 3.6 — Customer Payments (`useCustomerPayments.tsx`)

| Rule | Detail |
|------|--------|
| Payment allocation order | Oldest invoice first |
| Reversal order | Newest paid invoice first |
| Invoice status after update | `paid` / `partial` / `pending` based on amounts |
| Invoice pool | Excludes `cancelled`, `returned`, `lost` |
| Credit usage | `payment_terms = credit` only · excludes cancelled/returned/lost |

---

### 3.7 — Inventory (`DB triggers + hooks`)

**Stock status (non-variant):**
```
stock_quantity <= 0              → out_of_stock
stock_quantity <= low_stock_threshold → low_stock
otherwise                        → in_stock
```

**Variant products:** stock status based on sum of all variant stock.

**Stock deduction triggers:**
- Sale item insert → deduct stock
- Sale item update → adjust delta
- Sale item delete → restore stock
- Skip deduction if sale is already `cancelled` / `returned` / `lost`

**Stock restoration:**
- `→ cancelled` : restore once (idempotent)
- `→ returned`  : restore once (idempotent)
- `→ lost`      : do NOT restore
- Reactivation from `cancelled`/`returned` → deduct again

---

### 3.8 — Exchange Orders (Placeholder Only)

Do NOT implement exchange accounting.
Add schema placeholders only:

```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_status text DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_reference_sale_id uuid DEFAULT NULL;
```

Leave all exchange logic inactive and clearly commented.

---

## PHASE 4 — DATABASE TRIGGERS (`supabase/migrations/`)

Create a new migration file. Triggers must:

- Auto-deduct stock on sale item insert/update/delete
- Auto-restore stock on status → `cancelled` or `returned`
- NOT restore on → `lost`
- Re-deduct on reactivation from `cancelled`/`returned`
- Auto-set `status_changed_at` on any status change
- Auto-set `cancelled_at`, `returned_at`, `lost_at` on respective transitions
- Be **idempotent** (safe to run multiple times)
- Be **race-condition safe** (use `FOR UPDATE` where needed)
- Be **transaction safe**

---

## PHASE 5 — TESTS

Write tests for every case below. Use the project's existing test setup.

| Test Case | Expected Outcome |
|-----------|-----------------|
| COD sale → `delivered` | `payment_status=paid`, `amount_due=0`, stock unchanged |
| Credit sale → `delivered` | `payment_status=pending`, amounts unchanged, stock unchanged |
| Any sale → `cancelled` | `payment_status=cancelled`, amounts zeroed, stock restored |
| Any sale → `returned` | Same as cancelled |
| Any sale → `lost` | `payment_status=cancelled`, amounts zeroed, stock NOT restored |
| Partial payment sale | Revenue = `amount_paid - fee` only |
| Customer payment allocation | Oldest invoice paid first |
| Reactivation after cancel | Stock deducted again |
| `payout_ready` | Treated same as delivered (non-credit) |
| Dashboard vs. Reports | Identical revenue and unit totals for same dataset |

---

## PHASE 6 — DOCUMENTATION

Generate the final rule matrix as a table:

| Status | Revenue Included | COD Due | Credit Due | Payment Status | Amount Paid | Amount Due | Inventory | Customer Stats |
|--------|-----------------|---------|------------|---------------|-------------|------------|-----------|---------------|
| `not_sent` | | | | | | | | |
| `pending` | | | | | | | | |
| `in_review` | | | | | | | | |
| `sent` | | | | | | | | |
| `in_transit` | | | | | | | | |
| `delivery_ready` | | | | | | | | |
| `out_for_delivery` | | | | | | | | |
| `delivered` (COD) | | | | | | | | |
| `delivered` (credit) | | | | | | | | |
| `payout_ready` | | | | | | | | |
| `cancelled` | | | | | | | | |
| `returned` | | | | | | | | |
| `lost` | | | | | | | | |

Fill in every cell. Do not leave blanks.

---

## OUTPUT FORMAT REQUIREMENTS

Return results in this exact order:

1. **Phase 1** — Analysis summary + inconsistency list + file manifest
2. **Phase 2** — Architecture proposal + schema changes
3. **Phase 3** — Code diffs for all modified files
4. **Phase 4** — SQL migration file (full content, not snippets)
5. **Phase 5** — Test file(s) with all test cases
6. **Phase 6** — Completed rule matrix table

---

## HARD CONSTRAINTS

- Do NOT give generic advice. Every output must be concrete and production-ready.
- Do NOT break existing data. All schema changes must be migration-safe.
- Do NOT modify business rules — implement them exactly as specified.
- Do NOT patch inline conditions across files — centralize into `src/lib/businessRules/`.
- All modules (dashboard, reports, customers, payments, sales) MUST import from the shared rule layer.
- Preserve current UI unless a rule change requires UI modification.
- Mark all assumptions explicitly with `// ASSUMPTION:` comments in code.
