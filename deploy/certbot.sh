#!/usr/bin/env bash
#
# 为 .env 里的 domain 申请 / 续期 Let's Encrypt 证书（nginx 自动配置 HTTPS）
# 前提：域名已解析到本机 ip、80 端口可从公网访问
# 用法：./deploy/certbot.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "❌ 缺少 .env"; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${ip:?❌ .env 缺少 ip}" "${name:?❌ .env 缺少 name}" "${password:?❌ .env 缺少 password}" "${domain:?❌ .env 缺少 domain}"

EMAIL_FLAG="--register-unsafely-without-email"
[ -n "${email:-}" ] && EMAIL_FLAG="-m ${email}"
export ip name password domain EMAIL_FLAG

command -v expect >/dev/null 2>&1 || { echo "❌ 需要 expect（macOS 自带）"; exit 1; }

echo "==> 为 ${domain} 申请证书"
expect <<'EXP'
set timeout 300
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $env(name)@$env(ip) "dnf install -y epel-release >/dev/null 2>&1; dnf install -y certbot python3-certbot-nginx >/dev/null 2>&1; certbot --nginx -d $env(domain) --non-interactive --agree-tos $env(EMAIL_FLAG) --redirect"
expect {
  -re {[Pp]assword:} { send -- "$env(password)\r"; exp_continue }
  -re {[Yy]es/[Nn]o} { send -- "yes\r"; exp_continue }
  timeout { puts "❌ 超时"; exit 1 }
  eof
}
EXP

echo ""
echo "✅ 证书就绪：https://${domain}/"
