#!/usr/bin/env bash
# Deploy kv-roomboss on the Plesk server. Runs as the site user (never root).
# Usage: scripts/deploy.sh [branch]   (branch: main|master, default: master)
#
# Safe for untracked/ignored files: we only use `git fetch` + `git reset --hard`,
# which never removes untracked or ignored files. `git clean` is NOT used, so
# .env, data/accounts.json, app.js (Passenger entry), tmp/ and .node-version survive.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/vhosts/thebetawebsite.com/rb.kv.thebetawebsite.com/app}"
BRANCH="${1:-${DEPLOY_BRANCH:-master}}"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/plesk/node/22/bin}"

case "$BRANCH" in main|master) ;; *) echo "Refusing to deploy branch '$BRANCH'" >&2; exit 2;; esac
if [ "$(id -u)" = "0" ]; then echo "Do not run as root; run as the site user." >&2; exit 2; fi

export PATH="$NODE_BIN_DIR:$PATH"
cd "$APP_DIR"

echo "==> Fetching origin/$BRANCH"
git fetch --prune origin "$BRANCH"
PREV="$(git rev-parse --short HEAD)"
git reset --hard "origin/$BRANCH"
echo "==> $PREV -> $(git rev-parse --short HEAD)"

echo "==> Installing production dependencies"
npm ci --omit=dev --no-audit --no-fund

echo "==> Syntax check"
node --check server.js

mkdir -p tmp data
touch tmp/restart.txt
echo "==> Restart requested (Passenger tmp/restart.txt). Done."
