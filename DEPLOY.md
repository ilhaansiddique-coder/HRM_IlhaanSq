# Deploying to Vercel (via GitHub)

This project is ready for public beta testing. Before clicking "Deploy" on Vercel, work through the checklist below in order. Steps that **only you can do** are marked with 🙋.

---

## 1. 🙋 Rotate the leaked secrets (do this before anything else)

The repo's git history contains real secrets that were previously committed. Even after removing them from the working tree, anyone who cloned the repo has them. **Rotate first, purge history second.**

### Supabase

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project → **Settings → API**.
2. Click **Reset** next to the `anon` and `service_role` keys.
3. Copy the new values. They replace:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. In **Settings → Database**, rotate the database password. Update `PLATFORM_DATABASE_URL` and `PLATFORM_DATABASE_POOLER_URL` in your env.

### Gmail SMTP

1. [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → delete the old app password.
2. Generate a new one. Replaces `SMTP_PASS`.

### AUTH_SECRET

```bash
openssl rand -base64 32
```

Replaces `AUTH_SECRET`. Rotating this logs everyone out — expected.

---

## 2. 🙋 Purge secrets from git history

Only run this if the repo is/was public, or if untrusted people have clones. If you've never pushed it anywhere, just skip this step and make sure no `.env*` file is currently tracked (already verified).

```bash
pip install git-filter-repo        # if you don't have it
git filter-repo --path .env.production --invert-paths
git filter-repo --path .env --invert-paths
git filter-repo --path .env.development.local --invert-paths

# force-push (destructive — anyone else with a clone needs to re-clone)
git push origin --force --all
git push origin --force --tags
```

If the remote doesn't exist yet, skip the push.

---

## 3. Required services (all have free tiers)

| Service | What for | Free tier limit |
|---|---|---|
| **Supabase** | Postgres + Storage (product images) | 500MB DB, 1GB storage |
| **Vercel** | Hosting | 100 GB bandwidth / month |
| **Upstash Redis** | Rate limiting (strongly recommended) | 10k commands / day |
| **Gmail SMTP** | Password-reset emails | 500 emails / day |

You already have Supabase + Gmail. Create just Upstash:

### Upstash Redis

1. [console.upstash.com](https://console.upstash.com) → **Create database** → pick any region close to Vercel's (e.g. us-east-1).
2. Copy the **REST URL** and **REST token**. (Not the TCP URL.)
3. Paste into `.env.local` as:
   ```
   UPSTASH_REDIS_REST_URL=https://...upstash.io
   UPSTASH_REDIS_REST_TOKEN=...
   ```

Without these, rate limiting silently no-ops — do not skip for public testing.

### Observability — use Vercel's built-in logs

No third-party error tracking for now. Vercel streams every `console.error` and unhandled exception to the **Runtime Logs** tab in your project dashboard. Hobby tier retains ~1 hour of logs, which is enough for live triage during beta.

To view logs while debugging:

1. Vercel dashboard → your project → **Logs** tab.
2. Filter by function name or status code (`>=500`).
3. Click a log line to see the full stack trace.

If you later want persistent error tracking, the Sentry SDK scaffold is already wired in (see `sentry.server.config.ts` and `instrumentation.ts`). Just set `SENTRY_DSN` in Vercel env and it activates — no code changes. Free options:
- **Sentry Developer tier** — 5k errors/month, free forever ([sentry.io](https://sentry.io)). The "14-day trial" on signup is the Business tier wrapper; your account stays free after it ends.
- **GlitchTip** — Sentry-compatible OSS ([glitchtip.com](https://glitchtip.com)), 1k events/month on their hosted free tier. Just use their DSN in the same env var.

---

## 4. Apply pending migrations

One migration from this project hasn't been applied to your Supabase DB yet:

```bash
supabase db push          # if linked: supabase link --project-ref <ref>
# or apply manually via the SQL editor:
# supabase/migrations/20260422000000_product_categories.sql
```

Confirm by running in the Supabase SQL editor:

```sql
select count(*) from public.product_categories;
```

Should return `0` (not an error about missing table).

---

## 5. Push to GitHub

```bash
# Make sure no secrets are committed
git ls-files | grep -E "\.env"   # should print nothing

# Push
git add .
git commit -m "prep for deploy"
git push origin ilhaan          # or whichever branch you want to deploy
```

Create a PR → merge to `main` if you want `main` to be the deployed branch. Otherwise, Vercel can deploy from `ilhaan` directly.

---

## 6. Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick this repo.
2. **Framework Preset**: Next.js (auto-detected).
3. **Root Directory**: leave blank.
4. **Build Command**: `npm run build` (default).
5. **Environment Variables** — paste these in (use the **rotated** values from step 1):
   ```
   PLATFORM_DATABASE_URL=          # pooler URL strongly recommended on Vercel
   PLATFORM_DATABASE_POOLER_URL=
   PLATFORM_DATABASE_ENABLE_POOLER_FALLBACK=1
   PLATFORM_DATABASE_SSL_MODE=require
   DATABASE_URL=                   # = PLATFORM_DATABASE_POOLER_URL on Vercel
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   AUTH_SECRET=
   AUTH_URL=https://<your-vercel-url>.vercel.app
   NEXTAUTH_URL=https://<your-vercel-url>.vercel.app
   AUTH_TRUST_HOST=true
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   # SENTRY_DSN=                   # optional; leave unset to rely on Vercel Runtime Logs
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=
   SMTP_PASS=
   SMTP_FROM_ADDRESS=
   NEXT_PUBLIC_APP_URL=https://<your-vercel-url>.vercel.app
   ```
6. Click **Deploy**. First build takes ~3 minutes.

---

## 7. Post-deploy smoke test

Work through this before inviting beta users:

- [ ] Sign up → confirm you land on `/onboarding` or dashboard.
- [ ] Create a product → upload an image → verify image shows in the list.
- [ ] Create a product with variants → edit it → verify variant matrix prefills.
- [ ] Duplicate a product → verify it gets `(1)` suffix.
- [ ] Open a second browser in incognito, sign up as a **different** tenant. Verify you **cannot** see the first tenant's products.
- [ ] Try to edit a first-tenant product from the second tenant's session by pasting the id into a request (via DevTools) — should get 404/403.
- [ ] Trigger password reset flow → confirm email arrives.
- [ ] Spam login with wrong password 30 times → should start throwing "Too many login attempts".
- [ ] Trigger a deliberate error (e.g. submit a malformed product) → open **Vercel → Logs** and confirm you see the stack trace.

---

## What I didn't fix (non-blocking for testing, but note for post-launch)

- **Image orphans**: when a product's image is replaced or the product is deleted, the old Supabase Storage object isn't removed. Free tier is 1GB, monitor usage.
- **No image resize**: 5MB cap stands. Users with phone photos > 5MB will be rejected. Fix with `sharp` server-side.
- **Indexes**: the audit flagged ~6 missing Prisma indexes. Not blocking at MVP scale. Revisit once you have real traffic data.
- **Invoice-number race condition**: concurrent sales within one tenant may collide on invoice number. Rare with a single admin; fix with a per-tenant Postgres sequence if this bites.
- **`tenantDb` coverage gaps**: helper doesn't intercept variants / attributes / HR models. Explicit `tenantId` checks are in place in all write services (confirmed by this commit), but a future refactor to a uniform scoping layer would reduce drift risk.

---

## Troubleshooting

**"Upload failed" with no specific reason** → check Vercel function logs; the server logs the underlying error.

**"Storage not configured"** → `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel env. Re-add and redeploy.

**Login fails with 500** → `AUTH_SECRET` missing or `DATABASE_URL` wrong. Check function logs.

**"Too many login attempts" after 1 try** → Upstash was just added and has residual state; wait 60s or manually clear the `ratelimit:*` keys in Upstash console.

**DB connection timeouts on Vercel** → you're using the direct URL instead of the pooler. Switch `DATABASE_URL` to `PLATFORM_DATABASE_POOLER_URL` (port 6543 + `pgbouncer=true`).
