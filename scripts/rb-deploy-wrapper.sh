#!/usr/bin/env bash
# Installed on the server as /usr/local/bin/rb-deploy (root-owned, 0755).
# Used as the forced command= for the CI deploy key in /root/.ssh/authorized_keys,
# so that key can do nothing except run the deploy as the site user.
# Optional SSH_ORIGINAL_COMMAND: "deploy <main|master>".
set -euo pipefail
SITE_USER="thebetawebsite.com_u23s4ghs9ke"
APP_DIR="/var/www/vhosts/thebetawebsite.com/rb.kv.thebetawebsite.com/app"
BRANCH="master"
read -r -a ARGS <<< "${SSH_ORIGINAL_COMMAND:-}"
if [ "${ARGS[0]:-}" = "deploy" ] && [ -n "${ARGS[1]:-}" ]; then BRANCH="${ARGS[1]}"; fi
case "$BRANCH" in main|master) ;; *) echo "Refusing branch '$BRANCH'" >&2; exit 2;; esac
# As the unprivileged site user: fetch, then run the deploy script from the
# fetched commit (so the very first deploy works and script changes apply at once).
exec sudo -H -u "$SITE_USER" bash -c '
  set -euo pipefail
  cd "$1"
  git fetch -q --prune origin "$2"
  git show "origin/$2:scripts/deploy.sh" | APP_DIR="$1" bash -s -- "$2"
' _ "$APP_DIR" "$BRANCH"
