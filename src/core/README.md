# Core

Purpose:
- Shared platform foundations used across all modules
- Auth, session, tenant membership, role resolution, notifications, billing, audit, and shell-level concerns

Planned ownership:
- `auth/`
- `tenants/`
- `billing/`
- `permissions/`
- `notifications/`
- `audit/`
- `layout/`

Migration rule:
- Move code here only after the target responsibility is stable and reused by more than one module.
- Do not break existing imports while introducing these boundaries.
