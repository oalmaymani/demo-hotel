#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <domain> <email>"
  echo "Example: $0 almawsimin.serve-hotels.com admin@example.com"
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"

sudo apt-get update -y
sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect

sudo systemctl enable certbot.timer || true
sudo systemctl start certbot.timer || true
sudo certbot renew --dry-run

echo "SSL is configured for ${DOMAIN}."
