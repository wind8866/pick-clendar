# calendar-pick 站点配置模板
# 由 deploy.sh 从 .env 渲染后上传到 /etc/nginx/conf.d/calendar-pick.conf
# 占位符由 .env 注入：domain / port / remote_dir
# 注意：HTTPS 证书路径依赖 domain 对应的证书，换域名前先跑 deploy/certbot.sh

server {
    listen __PORT__ default_server;
    listen [::]:__PORT__ default_server;
    server_name __DOMAIN__ _;

    # 域名统一走 HTTPS
    if ($host = __DOMAIN__) {
        return 301 https://$host$request_uri;
    }

    root __REMOTE_DIR__;
    index index.html;

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.ics$ {
        add_header Content-Type "text/calendar; charset=utf-8";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl ipv6only=on;
    server_name __DOMAIN__ _;

    root __REMOTE_DIR__;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/__DOMAIN__/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.ics$ {
        add_header Content-Type "text/calendar; charset=utf-8";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
