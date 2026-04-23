# Remote Supabase Bootstrap

This runbook restores the current shared-schema app on a fresh remote Supabase project.

## What This Does

- applies the existing app migrations from `supabase/migrations`
- deploys the edge functions used by the current frontend
- prepares the remote project so frontend signup/login/onboarding can work again

This is the current-app track, not the v8 control-plane track.

## Prerequisites

- Supabase CLI installed
- Docker not required for remote bootstrap
- `SUPABASE_ACCESS_TOKEN` exported in your shell
- real secrets written into `supabase/.env.remote`

## Project Reference

This repo is configured for:

```text
alhntgyjagjiobqzflqc
```

## Required Local Files

1. Create `supabase/.env.remote` from `supabase/.env.remote.example`
2. Fill in:

```env
SUPABASE_URL=https://alhntgyjagjiobqzflqc.supabase.com
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=http://localhost:3000
```

Optional but recommended:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
```

## Bootstrap Commands

Set your Supabase personal access token:

```powershell
$env:SUPABASE_ACCESS_TOKEN="your-personal-access-token"
```

Push schema and deploy functions:

```powershell
npm run supabase:remote:bootstrap
```

Set edge function secrets:

```powershell
supabase secrets set --project-ref alhntgyjagjiobqzflqc --env-file supabase/.env.remote
```

If you need to redeploy functions only:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/bootstrap-supabase-remote.ps1 -SkipDbPush
```

## Important Separation

- `supabase/migrations/*` is the current app schema
- `infra/migrations/platform/*` is the future v8 control-plane schema

Do not apply both stacks to the same database unless we intentionally design that merge.
