#!/usr/bin/env bash
# One-time server prep: Node.js 20 LTS + Nginx (Ubuntu/Debian).
#
# Tencent Cloud 安全组（控制台）：入站 TCP 22（SSH）、80（HTTP）；若 HTTPS 加 443。
# 若 WebSocket 直连端口不走 Nginx 反代，再加 3003。
#
# 可选：本机 ufw（与安全组策略一致）
#   sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg nginx

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20\.'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "node $(node -v) | nginx $(nginx -v 2>&1 | cut -d/ -f2)"
