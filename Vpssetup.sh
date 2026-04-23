#!/bin/bash
# =============================================================
# scripts/vps-setup.sh
# Run ONCE on a fresh VPS to prepare it for CI/CD deployments
# Usage: bash scripts/vps-setup.sh
# Tested on: Ubuntu 22.04 LTS
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log()  { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

# Must run as root
[ "$EUID" -eq 0 ] || err "Run as root: sudo bash scripts/vps-setup.sh"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VPS Setup for Next.js SaaS — Auto-Deploy Ready"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System Update ─────────────────────────────────────
echo ""
echo "📦 Updating system packages..."
apt-get update -y -q
apt-get upgrade -y -q
apt-get install -y -q git curl wget unzip nginx ufw htop python3 python3-pip certbot python3-certbot-nginx
log "System packages installed"

# ── 2. Node.js 20 LTS ───────────────────────────────────
echo ""
echo "📦 Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y -q nodejs
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
log "Node.js $NODE_VER, npm $NPM_VER"

# ── 3. PM2 ──────────────────────────────────────────────
echo ""
echo "📦 Installing PM2..."
npm install -g pm2 > /dev/null 2>&1
pm2 startup systemd -u root --hp /root > /dev/null 2>&1
systemctl enable pm2-root 2>/dev/null || true
log "PM2 installed"

# ── 4. Deploy user ──────────────────────────────────────
echo ""
echo "👤 Creating deploy user..."
if id "deployer" &>/dev/null; then
  warn "User 'deployer' already exists — skipping"
else
  useradd -m -s /bin/bash deployer
  # Allow deployer to reload nginx without password
  echo "deployer ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx, /usr/bin/systemctl status nginx" \
    > /etc/sudoers.d/deployer-nginx
  chmod 440 /etc/sudoers.d/deployer-nginx
  log "User 'deployer' created"
fi

# ── 5. Directory structure ───────────────────────────────
echo ""
echo "📁 Creating deploy directory structure..."
APP_DIR="/var/www/saas"
mkdir -p "$APP_DIR/releases"
mkdir -p "$APP_DIR/shared/logs"
mkdir -p "$APP_DIR/shared/.next/cache"
chown -R deployer:deployer "$APP_DIR"
log "Directory structure: $APP_DIR"

# ── 6. SSH key for GitHub Actions ───────────────────────
echo ""
echo "🔑 Generating SSH deploy key..."
DEPLOYER_SSH="/home/deployer/.ssh"
mkdir -p "$DEPLOYER_SSH"
ssh-keygen -t ed25519 -C "github-actions-deploy@$(hostname)" \
  -f "$DEPLOYER_SSH/deploy_key" -N "" -q
cat "$DEPLOYER_SSH/deploy_key.pub" >> "$DEPLOYER_SSH/authorized_keys"
chmod 700 "$DEPLOYER_SSH"
chmod 600 "$DEPLOYER_SSH/deploy_key" "$DEPLOYER_SSH/authorized_keys"
chmod 644 "$DEPLOYER_SSH/deploy_key.pub"
chown -R deployer:deployer "$DEPLOYER_SSH"
log "SSH deploy key generated"

# ── 7. Nginx config ─────────────────────────────────────
echo ""
echo "🌐 Configuring nginx..."

# Get domain from user
read -p "Enter your domain (e.g. yourapp.com): " DOMAIN

cat > /etc/nginx/sites-available/saas << NGINX
upstream nextjs_upstream {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options           "DENY"                            always;
    add_header X-Content-Type-Options    "nosniff"                         always;
    add_header X-XSS-Protection          "1; mode=block"                   always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json
               application/javascript application/xml+rss
               application/atom+xml image/svg+xml;

    # Next.js static assets — serve directly, cache 1 year
    location /_next/static/ {
        alias /var/www/saas/current/.next/static/;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # Public directory
    location /public/ {
        root /var/www/saas/current;
        expires 7d;
        access_log off;
    }

    # Health check — no logs
    location = /api/health {
        proxy_pass http://nextjs_upstream;
        access_log off;
    }

    # Everything else → Next.js
    location / {
        proxy_pass         http://nextjs_upstream;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;

        # Next.js streaming support
        proxy_buffering    off;
        proxy_buffer_size  4k;
    }

    client_max_body_size 10M;
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/saas /etc/nginx/sites-enabled/saas
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
log "Nginx configured for: $DOMAIN"

# ── 8. Firewall ─────────────────────────────────────────
echo ""
echo "🔥 Configuring firewall..."
ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
log "UFW firewall enabled (22, 80, 443)"

# ── 9. Create .env.local template ───────────────────────
echo ""
echo "📝 Creating .env.local template..."
cat > "$APP_DIR/shared/.env.local.template" << 'ENVTEMPLATE'
# ── Copy this to .env.local and fill in all values ──────
# Never commit .env.local to git!

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Analytics
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID=XXXXXXXXXX

# App
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN.com
NODE_ENV=production
PORT=3000
ENVTEMPLATE

chown deployer:deployer "$APP_DIR/shared/.env.local.template"
warn "Create /var/www/saas/shared/.env.local with your real values!"
echo "    cp $APP_DIR/shared/.env.local.template $APP_DIR/shared/.env.local"
echo "    nano $APP_DIR/shared/.env.local"

# ── Done — show summary ──────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ VPS setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  NEXT STEPS:"
echo ""
echo "  1. Copy this PRIVATE KEY to GitHub Secrets as VPS_SSH_KEY:"
echo "     (Repo → Settings → Secrets → Actions → New secret)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$DEPLOYER_SSH/deploy_key"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  2. Fill in your secrets:"
echo "     nano $APP_DIR/shared/.env.local"
echo ""
echo "  3. Get SSL certificate:"
echo "     certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "  4. Add VPS_HOST=$( hostname -I | awk '{print $1}' ) to GitHub Secrets"
echo ""
