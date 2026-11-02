#!/usr/bin/env bash
#
# 一键部署：本地构建 -> 上传 dist -> 从 .env 渲染 nginx 配置并上传 -> 重启 nginx
# 依赖：.env（ip / name / password / domain，可选 remote_dir / port）、pnpm、expect
# 用法：./deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

# ---------- 读取 .env ----------
if [[ ! -f .env ]]; then
  echo "❌ 缺少 .env 文件（需包含 ip / name / password / domain）"
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${ip:?❌ .env 缺少 ip}" \
  "${name:?❌ .env 缺少 name}" \
  "${password:?❌ .env 缺少 password}" \
  "${domain:?❌ .env 缺少 domain}"

REMOTE_DIR="${remote_dir:-/var/www/calendar-pick}"
REMOTE_CONF="/etc/nginx/conf.d/calendar-pick.conf"
PORT="${port:-80}"
LOCAL_CONF="$(mktemp "${TMPDIR:-/tmp}/calendar-pick-nginx.XXXXXX")"
trap 'rm -f "${LOCAL_CONF}"' EXIT

# 默认日历 id 从 raw 配置读取，不写死具体排片表
DEFAULT_FESTIVAL_ID="$(node -e '
const fs = require("fs");
const dir = "src/data/raw";
const metas = fs.readdirSync(dir).filter((f) => f.endsWith(".raw.json"))
  .map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")).meta);
const picked = metas.find((m) => m && m.isDefault) || metas[0];
process.stdout.write(picked && picked.id ? picked.id : "");
' 2>/dev/null || true)"

# ---------- 用 .env 渲染 nginx 配置 ----------
sed -e "s|__DOMAIN__|${domain}|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__REMOTE_DIR__|${REMOTE_DIR}|g" \
    deploy/nginx.conf.tpl > "${LOCAL_CONF}"

export ip name password domain REMOTE_DIR REMOTE_CONF PORT LOCAL_CONF

command -v expect >/dev/null 2>&1 || { echo "❌ 需要 expect（macOS 自带 /usr/bin/expect）"; exit 1; }

echo "==> 1/4 生成数据并构建（build 的 prebuild 会自动执行 gen）"
pnpm build

echo "==> 2/4 上传 dist → ${name}@${ip}:${REMOTE_DIR}/"
expect <<'EXP'
set timeout 300
spawn scp -r -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {*}[glob dist/*] $env(name)@$env(ip):$env(REMOTE_DIR)/
expect {
  -re {[Pp]assword:} { send -- "$env(password)\r"; exp_continue }
  -re {[Yy]es/[Nn]o} { send -- "yes\r"; exp_continue }
  timeout { puts "❌ 上传超时"; exit 1 }
  eof
}
EXP

echo "==> 3/4 上传 nginx 配置（${domain}）"
expect <<'EXP'
set timeout 60
spawn scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $env(LOCAL_CONF) $env(name)@$env(ip):$env(REMOTE_CONF)
expect {
  -re {[Pp]assword:} { send -- "$env(password)\r"; exp_continue }
  -re {[Yy]es/[Nn]o} { send -- "yes\r"; exp_continue }
  timeout { puts "❌ 超时"; exit 1 }
  eof
}
EXP

echo "==> 4/4 校验并重启 nginx"
expect <<'EXP'
set timeout 120
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $env(name)@$env(ip) {command -v nginx >/dev/null 2>&1 || dnf install -y nginx; nginx -t && systemctl enable nginx && systemctl restart nginx && systemctl is-active nginx}
expect {
  -re {[Pp]assword:} { send -- "$env(password)\r"; exp_continue }
  -re {[Yy]es/[Nn]o} { send -- "yes\r"; exp_continue }
  timeout { puts "❌ 超时"; exit 1 }
  eof
}
EXP

echo ""
echo "✅ 部署完成："
if [[ -n "${DEFAULT_FESTIVAL_ID}" ]]; then
  echo "   https://${domain}/pick/${DEFAULT_FESTIVAL_ID}"
  echo "   http://${ip}/pick/${DEFAULT_FESTIVAL_ID}"
else
  echo "   https://${domain}/"
  echo "   http://${ip}/"
fi
