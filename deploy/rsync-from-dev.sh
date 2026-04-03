#!/usr/bin/env bash
# Sync connect5 from your dev machine to the server (run on dev, not on server).
# Usage: RSYNC_TARGET=user@server:/path/to/connect5 bash deploy/rsync-from-dev.sh
#
# Excludes node_modules and dist so the server runs npm ci && npm run build.

set -euo pipefail

TARGET="${RSYNC_TARGET:-}"
if [[ -z "$TARGET" ]]; then
  echo "Set RSYNC_TARGET=user@host:/path/to/connect5" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rsync -avz --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$HERE/" "$TARGET/"
