#!/bin/bash
# One-time setup for auto-deploy on Hetzner
# Run this on your Hetzner server after cloning the repo

set -e

REPO_DIR="${REPO_DIR:-/root/Marketing-Machine-Voice-Intake-}"

echo "=== Workshop Auto-Deploy Setup ==="

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# Build the Next.js app for production
echo "Building workshop app..."
cd "$REPO_DIR/workshop-app"
npm install
npm run build

# Start the Next.js app with PM2
echo "Starting workshop app..."
pm2 delete workshop-app 2>/dev/null || true
pm2 start npm --name workshop-app --cwd "$REPO_DIR/workshop-app" -- run start -- --hostname 0.0.0.0 --port 3000

# Start the webhook listener with PM2
echo "Starting webhook listener..."
pm2 delete deploy-webhook 2>/dev/null || true
pm2 start "$REPO_DIR/deploy/webhook-server.mjs" --name deploy-webhook

# Save PM2 config so it survives reboot
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "=== Done ==="
echo "Workshop app:    http://0.0.0.0:3000"
echo "Webhook listener: http://0.0.0.0:9000/webhook"
echo ""
echo "Next step: Add a GitHub webhook pointing to http://<your-server-ip>:9000/webhook"
echo "  Event: Just the push event"
echo "  Content type: application/json"
echo "  Secret: (optional, set WEBHOOK_SECRET env var to match)"
