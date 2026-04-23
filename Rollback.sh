#!/bin/bash
# scripts/rollback.sh
# Manual rollback to previous release
# Run on VPS: bash /var/www/saas/current/scripts/rollback.sh
# Run remotely: ssh deployer@VPS_IP 'bash /var/www/saas/current/scripts/rollback.sh'

set -euo pipefail

DEPLOY_DIR="/var/www/saas"
CURRENT=$(readlink "$DEPLOY_DIR/current" 2>/dev/null || echo "none")
RELEASES=( $(ls -t "$DEPLOY_DIR/releases" 2>/dev/null) )

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Manual Rollback Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Current: $(basename $CURRENT)"
echo ""
echo "  Available releases:"
for i in "${!RELEASES[@]}"; do
  MARKER=""
  [ "$DEPLOY_DIR/releases/${RELEASES[$i]}" = "$CURRENT" ] && MARKER=" ← current"
  echo "    [$i] ${RELEASES[$i]}$MARKER"
done
echo ""

if [ "${#RELEASES[@]}" -lt 2 ]; then
  echo "❌ No previous release to rollback to."
  exit 1
fi

# Default: roll back to release [1] (second most recent)
TARGET_IDX=1
read -p "Roll back to release [$TARGET_IDX] (or enter index number): " INPUT
TARGET_IDX=${INPUT:-1}

TARGET="${RELEASES[$TARGET_IDX]}"

echo ""
echo "  Rolling back to: $TARGET"
read -p "  Confirm? (y/N): " CONFIRM
if [ "${CONFIRM,,}" != "y" ]; then
  echo "  Aborted."
  exit 0
fi

echo ""
echo "↩️  Switching symlink..."
ln -sfn "$DEPLOY_DIR/releases/$TARGET" "$DEPLOY_DIR/current"

echo "♻️  Reloading PM2..."
pm2 reload saas --update-env
pm2 save --force

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ Rollback complete → $TARGET"
echo ""
pm2 ls