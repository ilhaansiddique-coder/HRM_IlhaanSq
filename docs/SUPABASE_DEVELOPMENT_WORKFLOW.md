# Supabase Development Workflow

## One-time local setup

1. Install and verify Supabase CLI:
   - `supabase --version`
2. Authenticate once (persistent login):
   - `supabase login`
3. Verify your target project ref in `supabase/config.toml`:
   - `project_id = "alhntgyjagjiobqzflqc"`

## Day-to-day commands

- Push DB migrations only:
  - `npm run supabase:db:push:remote`
- Deploy all Edge Functions only:
  - `npm run supabase:functions:deploy:remote`
- Push DB + deploy all Edge Functions:
  - `npm run supabase:remote:bootstrap`
- Run Supabase CLI via Docker wrapper (for Device Guard-blocked Windows):
  - `npm run supabase:docker -- start`
  - `npm run supabase:docker -- status`
  - `npm run supabase:docker -- functions deploy demo-signup --project-ref alhntgyjagjiobqzflqc`

These scripts auto-read `supabase/config.toml`, auto-link the project, and work with either:
- cached CLI login (`supabase login`), or
- `SUPABASE_ACCESS_TOKEN` environment variable.

## Required remote secrets (Edge Functions)

Set all required secrets in remote Supabase:

`supabase secrets set --project-ref alhntgyjagjiobqzflqc --env-file supabase/.env.remote`

Minimum important keys:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `APP_URL`
- `ALLOWED_ORIGINS`
- `TENANT_REQUEST_NOTIFY_EMAILS` (optional, comma-separated superadmin emails for alert OTP)
- `APP_NAME` (optional, branding label in verification/sign-in emails)
- `SUPPORT_EMAIL` (optional, footer support contact in verification/sign-in emails)

## Auth email template (tenant request + sign-in)

Supabase `auth.signInWithOtp(...)` uses Auth Templates for outgoing emails.

Use the ready template in:
- `supabase/email-templates/auth-magic-link-template.md`

Apply it to both:
- `Authentication -> Templates -> Confirm signup`
- `Authentication -> Templates -> Magic Link`

## CORS checklist (LAN + local)

If browser runs at `http://192.168.x.x:3000`, include it in `ALLOWED_ORIGINS` or allow private LAN hosts with allowed ports. Current CORS helper already supports:
- localhost/127.0.0.1
- private IPv4 on ports `3000`, `5173`, `8080`, `8081`

## If deployment fails

1. `PAT missing/expired`
   - Run `supabase login` again, or set `SUPABASE_ACCESS_TOKEN`.
   - If local `supabase.exe` is blocked by Device Guard, use `npm run supabase:docker -- <args>`.
2. `No access to project/team`
   - Confirm your Supabase account has access to `alhntgyjagjiobqzflqc`.
3. `Wrong project ref`
   - Check `supabase/config.toml` project_id.
4. `CORS preflight non-OK`
   - Usually function is not deployed or crashed at startup.
   - Run `npm run supabase:functions:deploy:remote`.
5. Supabase email delivery issues
   - Confirm `SUPABASE_ANON_KEY` and `APP_URL` are set in function secrets.
   - Check Auth -> Email templates/settings in Supabase dashboard.
   - Request flow should continue even when verification email is skipped.

## CI auto-deploy

GitHub Actions workflow:
- `.github/workflows/supabase-functions.yml`
- deploys all `supabase/functions/*/index.ts` (except `_shared`) on push.
