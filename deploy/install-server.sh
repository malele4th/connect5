#!/usr/bin/env bash
# Install systemd unit + Nginx site for connect5. Run on the server with sudo.
# Usage: sudo CONNECT5_ROOT=/path/to/connect5 bash deploy/install-server.sh
#
# 若已用 my_web 的 deploy/install-server.sh 合并 80 配置（存在 /etc/nginx/sites-enabled/my_web），
# 本脚本将只更新 connect5-ws systemd，不再启用独立的 Nginx connect5 站点，避免与 my_web 冲突。

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run with sudo" >&2
  exit 1
fi

ROOT="${CONNECT5_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  echo "Set CONNECT5_ROOT to the connect5 project directory (contains package.json, dist/)." >&2
  exit 1
fi

ROOT="$(realpath "$ROOT")"
RUN_AS="${CONNECT5_USER:-ubuntu}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MY_WEB_MANAGED=false
if [[ -L /etc/nginx/sites-enabled/my_web ]]; then
  MY_WEB_MANAGED=true
fi

sed \
  -e "s|CONNECT5_ROOT_PLACEHOLDER|$ROOT|g" \
  -e "s|CONNECT5_USER_PLACEHOLDER|$RUN_AS|g" \
  "$SCRIPT_DIR/connect5-ws.service" \
  > /etc/systemd/system/connect5-ws.service

if [[ "$MY_WEB_MANAGED" == true ]]; then
  echo "检测到 my_web 已启用 Nginx 站点（sites-enabled/my_web），跳过 connect5 独立 Nginx 配置。" >&2
else
  sed "s|CONNECT5_ROOT_PLACEHOLDER|$ROOT|g" "$SCRIPT_DIR/nginx-connect5.conf" \
    > /etc/nginx/sites-available/connect5

  ln -sf /etc/nginx/sites-available/connect5 /etc/nginx/sites-enabled/connect5
  rm -f /etc/nginx/sites-enabled/default
fi

chmod -R a+rX "$ROOT/dist" 2>/dev/null || true
# nginx runs as www-data; it must traverse each parent of $ROOT (often /home/ubuntu is 750).
p="$ROOT"
while [[ "$p" != "/" && -n "$p" ]]; do
  chmod o+x "$p" 2>/dev/null || true
  p="$(dirname "$p")"
done

systemctl daemon-reload
systemctl enable connect5-ws
systemctl restart connect5-ws

if [[ "$MY_WEB_MANAGED" == true ]]; then
  nginx -t
  systemctl reload nginx
else
  nginx -t
  systemctl reload nginx
fi

echo "connect5-ws: $(systemctl is-active connect5-ws)"
echo "nginx: $(systemctl is-active nginx)"
