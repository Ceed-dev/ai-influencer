#!/usr/bin/env bash
set -euo pipefail

# v5.0 Production Deploy Script
# Usage: ./deploy.sh [--skip-build]
#
# Deploys the latest code from the current branch to the production VM.
# Steps: git push → SSH → git pull → npm install → build → container restart

VM_HOST="34.85.62.184"
VM_USER="pochi"
SSH_KEY="$HOME/.ssh/google_compute_engine"
REMOTE_DIR="/home/pochi/ai-influencer/v5"
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo "=== v5.0 Deploy ==="

# 1. Push local changes
echo "[1/4] Pushing to origin..."
cd "$(dirname "$0")/.."
git push origin "$(git branch --show-current)"

# 2-4. Remote operations via SSH
echo "[2/4] Pulling on VM..."
# shellcheck disable=SC2087
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${VM_USER}@${VM_HOST}" bash -s "$SKIP_BUILD" "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
SKIP_BUILD=$1
REMOTE_DIR=$2

cd "$REMOTE_DIR"
git pull --ff-only

echo "[3/4] Installing dependencies..."
npm install --prefix dashboard --production=false

if [ "$SKIP_BUILD" = "false" ]; then
  echo "[4/4] Building & restarting..."
  npm run build --prefix dashboard
else
  echo "[4/4] Restarting (build skipped)..."
fi

docker compose -f docker-compose.production.yml --env-file .env.production down
docker compose -f docker-compose.production.yml --env-file .env.production up -d

echo ""
echo "Waiting for health check..."
sleep 5
if docker inspect --format='{{.State.Running}}' v5-dashboard 2>/dev/null | grep -q true; then
  echo "v5-dashboard is running."
else
  echo "WARNING: v5-dashboard is not running. Check logs with: docker logs v5-dashboard"
  exit 1
fi
REMOTE

echo ""
echo "Deploy complete: https://ai-dash.0xqube.xyz"
