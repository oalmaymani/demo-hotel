#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/almawsimin-hotel}"

sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

sudo usermod -aG docker "$USER" || true

if ! docker compose version >/dev/null 2>&1; then
  DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
  mkdir -p "$DOCKER_CONFIG/cli-plugins"
  curl -SL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64 \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
fi

mkdir -p "$APP_DIR"

cat <<EOF
Server bootstrap complete.

Next steps:
1. Log out and back in so docker group permissions apply.
2. Clone the repo into: $APP_DIR
3. Create any production env overrides you need.
4. Let GitHub Actions deploy to this directory.
EOF
