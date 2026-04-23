# CI/CD Pipeline — Setup Guide
## Auto-Deploy: GitHub → VPS | Next.js 15 + Supabase

---

## HOW IT WORKS

```
You: git push origin main
          │
          ▼
GitHub Actions triggers automatically
          │
    ┌─────┴───────────────────┐
    │  Job 1: Lint + TypeCheck │  ~2 min (parallel)
    │  Job 2: Security Audit   │
    └─────┬───────────────────┘
          │ both pass?
          ▼
    ┌─────────────────────┐
    │  Job 3: Build       │  ~4 min
    └─────┬───────────────┘
          │
          ▼
    ┌───────────────────────────────────────────────┐
    │  Job 4: Deploy to VPS (main branch only)      │
    │                                               │
    │  1. npm build (production)                    │
    │  2. tar release → SCP upload to /tmp          │
    │  3. SSH → unpack to /var/www/saas/releases/   │
    │  4. Link shared .env.local                    │
    │  5. npm ci --omit=dev                         │
    │  6. Canary health check on port 3001          │
    │  7. Atomic symlink swap → zero downtime       │
    │  8. pm2 reload saas                           │
    │  9. nginx reload                              │
    │  10. Post-deploy health check from GitHub     │
    │                                               │
    │  If anything fails → auto-rollback            │
    └───────────────────────────────────────────────┘
          │
    Total: ~8-12 minutes from push to live
```

---

## STEP 1: Run VPS Setup (once)

```bash
# SSH into your fresh VPS as root
ssh root@YOUR_VPS_IP

# Upload and run the setup script
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/scripts/vps-setup.sh)

# Or copy scripts/vps-setup.sh to VPS and run:
bash scripts/vps-setup.sh
```

This script:
- Installs Node.js 20, PM2, Nginx, UFW, Certbot
- Creates `deployer` user with correct sudo rules
- Sets up `/var/www/saas/` directory structure
- Generates SSH key pair for GitHub Actions
- Configures nginx reverse proxy
- Enables firewall (ports 22, 80, 443 only)
- **Prints the private key** — copy it to GitHub Secrets as `VPS_SSH_KEY`

---

## STEP 2: Create .env.local on VPS

```bash
ssh deployer@YOUR_VPS_IP
nano /var/www/saas/shared/.env.local
```

Fill in every value. This file **never goes in git** — it lives only on the VPS.

---

## STEP 3: Add GitHub Secrets

Go to: **GitHub Repo → Settings → Secrets and Variables → Actions**

Add ALL of these:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPS CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPS_HOST                      = 123.456.789.0
VPS_SSH_KEY                   = -----BEGIN OPENSSH PRIVATE KEY-----
                                (full key from vps-setup.sh output)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPABASE (public — used in build)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPABASE (server-only — for migrations + RLS tests)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPABASE_SERVICE_ROLE_KEY     = eyJhbGc...
SUPABASE_ACCESS_TOKEN         = sbp_...      (from supabase.com/account)
SUPABASE_PROJECT_REF          = abcdefgh     (8-char project ID)
SUPABASE_DB_PASSWORD          = your-db-password

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APP URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_APP_URL           = https://yourapp.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYTICS (public — used in build)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_GA4_ID            = G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID       = XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID        = XXXXXXXXXX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRIPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRIPE_SECRET_KEY             = sk_live_...
STRIPE_WEBHOOK_SECRET         = whsec_...
STRIPE_PRICE_STARTER          = price_...
STRIPE_PRICE_PRO              = price_...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RLS TEST TENANTS (optional but recommended)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST_TENANT_A_ID              = uuid-of-test-tenant-a
TEST_TENANT_B_ID              = uuid-of-test-tenant-b

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTIFICATIONS (optional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLACK_WEBHOOK                 = https://hooks.slack.com/...  (deploy alerts)
```

---

## STEP 4: SSL Certificate (once on VPS)

```bash
ssh deployer@YOUR_VPS_IP
sudo certbot --nginx -d yourapp.com -d www.yourapp.com \
  --non-interactive --agree-tos --email admin@yourapp.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## STEP 5: First Deploy

```bash
# On your local machine
git add .
git commit -m "feat: add CI/CD pipeline"
git push origin main

# Watch it deploy at:
# https://github.com/YOUR_ORG/YOUR_REPO/actions
```

---

## FILES INCLUDED IN THIS PACKAGE

```
.github/
  workflows/
    deploy.yml       ← Main pipeline (lint → build → deploy)
    pr-check.yml     ← PR gate (type check + build)
    migrate.yml      ← DB migration runner

scripts/
  vps-setup.sh      ← One-time VPS provisioning
  rollback.sh       ← Manual rollback to previous release
  test-rls.js       ← RLS isolation test suite

app/
  api/health/
    route.ts        ← Health check endpoint

ecosystem.config.js  ← PM2 process manager config
CICD-SETUP.md        ← This file
```

---

## COMMON COMMANDS

```bash
# View live app logs
ssh deployer@VPS_IP 'pm2 logs saas --lines 50'

# Monitor CPU/RAM in real-time
ssh deployer@VPS_IP 'pm2 monit'

# Manual rollback
ssh deployer@VPS_IP 'bash /var/www/saas/current/scripts/rollback.sh'

# Check app health
curl https://yourapp.com/api/health

# View all releases
ssh deployer@VPS_IP 'ls -lt /var/www/saas/releases'

# Restart app (without new deploy)
ssh deployer@VPS_IP 'pm2 reload saas'

# View nginx error log
ssh deployer@VPS_IP 'sudo tail -f /var/log/nginx/error.log'

# Update env vars (no re-deploy needed)
ssh deployer@VPS_IP 'nano /var/www/saas/shared/.env.local && pm2 reload saas --update-env'
```

---

## VPS SIZING GUIDE

| Users       | CPU  | RAM  | Cost/mo (Hetzner) |
|-------------|------|------|-------------------|
| Dev/staging | 2    | 4GB  | ~€5               |
| 0–5K users  | 2    | 4GB  | ~€5               |
| 5K–20K      | 4    | 8GB  | ~€15              |
| 20K–100K    | 8    | 16GB | ~€30              |

**Recommended providers (cheapest → best):**
1. **Hetzner Cloud** — best value, pick Frankfurt (lowest latency from Bangladesh)
2. **DigitalOcean** — best docs
3. **Vultr** — good Singapore region option

---

## BRANCH STRATEGY

```
main        → auto-deploys to production
dev/staging → no auto-deploy (PRs get build check only)
feature/*   → PRs open against main (get build check)
```

To add a staging server, duplicate the deploy job in `deploy.yml`
and change the branch condition to `refs/heads/staging`.
