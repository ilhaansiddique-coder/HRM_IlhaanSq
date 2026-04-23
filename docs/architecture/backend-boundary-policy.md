# Backend Boundary Policy

Date: 2026-03-10

## Current Policy

- Runtime flag: `NEXT_PUBLIC_BACKEND_ACCESS_MODE`
- Allowed values:
  - `hybrid` (default): existing direct-RLS + API coexist.
  - `direct_rls`: legacy mode.
  - `api_first`: target mode for strict BFF/API boundary.

## Target State

1. Tenant UI modules call backend APIs (Nest/BFF) for business operations.
2. Supabase direct access is limited to authentication/session utilities.
3. RLS remains as defense-in-depth, not the primary business API surface.

## Migration Sequence

1. Move `sales` reads/mutations behind API endpoints.
2. Move `products` and inventory mutations behind API endpoints.
3. Keep `super-admin` on API (already API-based).
4. Lock `NEXT_PUBLIC_BACKEND_ACCESS_MODE=api_first` in production once migrations complete.

## Guardrails Added

- `src/lib/backendAccessPolicy.ts` centralizes boundary mode.
- `useSales` and `useProducts` now log warnings if running under `api_first` while still direct-RLS.
