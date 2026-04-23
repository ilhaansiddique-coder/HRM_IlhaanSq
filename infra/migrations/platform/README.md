Platform control-plane migrations for the v8 architecture.

Important:
- Apply these to the clean Supabase Postgres database you are using as `platform_db`.
- Do not run the legacy root `supabase/migrations` chain against that database.
- These files are intentionally separated from the current app's shared-schema migration history.

Recommended apply order:
1. `001_extensions_and_helpers.sql`
2. `002_control_plane_core.sql`
3. `003_control_plane_support_and_summaries.sql`
4. `004_seed_reference_data.sql`

Current scope:
- control-plane tables only
- no tenant business tables
- no Redis/Temporal runtime wiring
- no direct browser access assumptions
