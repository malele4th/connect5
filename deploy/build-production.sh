#!/usr/bin/env bash
# Production build. 前端部署在 /web/connect5/ 时，不设 VITE_WS_URL 会默认连
#   ws(s)://<页面同源>/web/connect5/socket（需 Nginx 反代该路径到 Node）。
# 若必须用固定完整地址（例如 CDN 分域），可传入：
#   bash deploy/build-production.sh ws://YOUR_IP/web/connect5/socket
#   bash deploy/build-production.sh wss://your.domain/web/connect5/socket

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

WS_URL="${1:-}"
if [[ -n "$WS_URL" ]]; then
  export VITE_WS_URL="$WS_URL"
fi

npm ci
npm run build
if [[ -n "${VITE_WS_URL:-}" ]]; then
  echo "Built dist/ with VITE_WS_URL=$VITE_WS_URL"
else
  echo "Built dist/ without VITE_WS_URL (client uses same-origin /web/connect5/socket)."
fi
