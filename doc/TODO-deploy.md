## 先明确一件事

TLS 证书不用买、不用申请人工审核：**Let's Encrypt 免费签发，90 天有效，工具会自动续期**。纯前端站点上线只有三步：把 `dist/` 传到 VPS → 用 Web 服务器托管静态文件 → 让 Web 服务器自动申请证书并监听 443。没有后端，所以不需要反向代理到 Node 进程，TLS 就在这层终止。

（我看了下当前仓库，只有 `src/data`、`doc/` 和需求文档，还没有 `package.json`/构建配置。下面按 Vite 的 `dist/` 讲，若后面改用 Nuxt 静态生成，产物目录换成 `.output/public` 即可。）

---

## 前置检查（90% 的失败都在这）

**1. DNS 指向 VPS**

在域名服务商处加 A 记录：

| 主机记录 | 类型 | 值 |
|---|---|---|
| `@` | A | 你的 VPS 公网 IP |
| `www` | A | 同上（需要 www 访问才加） |

验证（在你本机跑）：

```bash
dig +short example.com        # 必须返回你的 VPS IP
```

**2. 放行 80 和 443**

```bash
sudo ufw allow 80,443/tcp && sudo ufw status
```

⚠️ **还要去云厂商控制台的安全组/防火墙放行 80、443**（阿里云、腾讯云、AWS Lightsail 都有独立的安全组）。ufw 开了但安全组没开，是最常见的“证书签发超时”原因。

**3. 确认 80 端口没被别的程序占用**（比如旧 Apache、宝塔面板）

```bash
sudo ss -lntp | grep -E ':80|:443'
```

---

## 方案 A：Caddy（推荐，配置最少、证书全自动）

Caddy 默认就会为域名自动申请 Let's Encrypt 证书、自动跳转 HTTP→HTTPS、自动续期，最适合“我就想快点上线”。

```bash
# 安装（Debian/Ubuntu 官方源）
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile` 改成（域名换成你的）：

```caddyfile
example.com {
	root * /var/www/calendar
	encode zstd gzip

	# SPA 路由兜底：/pick/qingdao202602 直接访问也返回 index.html
	try_files {path} /index.html
	file_server

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
	}

	# 带 hash 的静态资源长缓存
	@assets path /assets/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
}

# 需要 www 一起访问就再加一段
# www.example.com { redir https://example.com{uri} }
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f      # 看证书签发日志，出现 certificate obtained 就好了
```

`try_files {path} /index.html` 这行不要省：你的路由是 `/pick/qingdao202602` 这种 history 模式路径，缺了它刷新页面会 404。

---

## 方案 B：Nginx + certbot（已经在用 Nginx 就选这个）

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/calendar`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    root /var/www/calendar;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/calendar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

然后一条命令让 certbot 自动签发并把配置改成 443 + 跳转：

```bash
sudo certbot --nginx -d example.com        # 有 www 就加 -d www.example.com
```

它会问邮箱（收续期提醒）和是否强制跳转 HTTPS，选跳转即可。续期靠 `certbot.timer` 自动完成，验证一次：

```bash
sudo certbot renew --dry-run
```

---

## 上传构建产物

本地：

```bash
npm run build          # 产物在 dist/
```

传上去（`--delete` 会清掉服务器上多余旧文件，路径确认无误再用）：

```bash
ssh user@VPS 'sudo mkdir -p /var/www/calendar'
rsync -avz --delete dist/ user@VPS:/var/www/calendar/
ssh user@VPS 'sudo chown -R www-data:www-data /var/www/calendar'
```

---

## 验收清单

```bash
curl -sI https://example.com | head -3
# 期望 HTTP/2 200

curl -sI http://example.com | head -3
# 期望 301/308 指向 https

curl -sI https://example.com/pick/qingdao202602 | head -1
# 期望 200（验证 SPA 兜底生效）

echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -issuer -dates
# 期望 issuer 是 Let's Encrypt，notAfter 约 90 天后
```

浏览器打开看到锁图标即可。想再稳一点可以跑一次 SSL Labs 评级（目标 A 或 A+）。

---

## 常见问题

| 现象 | 原因 |
|---|---|
| 证书签发超时 / `Timeout during connect` | 80 端口未放行（多查一次云安全组），或 DNS 还没生效 |
| 签发失败且域名在 Cloudflare 后面 | Cloudflare 代理会拦 HTTP-01 校验：临时改灰云（DNS only）签完再开，或改用 DNS-01 |
| 首页正常，刷新子路由 404 | 缺 SPA fallback（`try_files`） |
| Cloudflare 报 525/526 | SSL/TLS 模式设为 **Full (strict)**，但源站证书不被信任；用 Cloudflare Origin CA 证书或先签 Let's Encrypt |
| 页面能开但资源报错 | 混合内容：代码里有写死的 `http://` 链接或接口地址 |
| 续期莫名失败 | 后来关掉了 80 端口；续期校验同样需要 80 |

另外两点容易被忽略：VPS 系统时间不准会导致证书校验失败，用 `timedatectl` 确认已开 NTP；HSTS 头先在 HTTPS 完全跑通后再加，否则配错时浏览器会强制跳转、很难回滚。

---

## 如果不想碰证书

- **Cloudflare 免费版**：域名 NS 托管到 CF，开橙云代理 + `Full (strict)`，源站放 Cloudflare Origin CA 证书（15 年有效、不用续期），浏览器侧用 CF 的边缘证书。省心，但国内访问速度不一定好。
- **干脆不用 VPS**：纯静态站点直接丢 Cloudflare Pages / Netlify / Vercel，连域名绑定带自动 HTTPS 几分钟搞定，VPS 可以留着做别的事。

---

需要的话，我可以把上面这套直接落成仓库里的 `deploy/`（Caddyfile、nginx.conf、`deploy.sh` 一键 rsync，外加 GitHub Actions 自动部署），你只要填域名和 IP。告诉我 VPS 的系统（Debian/Ubuntu/CentOS）和是否已装 Nginx，我按你的环境改。