#!/usr/bin/env bash
set -euo pipefail

SITE_NAME="${1:-almawsimin-hotel}"
SERVER_NAME="${2:-_}"
APP_PORT="${3:-3000}"
API_PORT="${4:-4000}"
SITE_PATH="/etc/nginx/sites-available/${SITE_NAME}"
SITE_LINK="/etc/nginx/sites-enabled/${SITE_NAME}"

sudo apt-get update -y
sudo apt-get install -y nginx

sudo tee "$SITE_PATH" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -sfn "$SITE_PATH" "$SITE_LINK"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "Nginx is configured."
echo "Site: ${SITE_NAME}"
echo "Server name: ${SERVER_NAME}"
echo "Proxy target: http://127.0.0.1:${APP_PORT}"
echo "API target: http://127.0.0.1:${API_PORT}"
