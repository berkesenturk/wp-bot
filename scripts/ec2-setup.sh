#!/usr/bin/env bash
# One-time setup for EC2 (Amazon Linux 2023).
# Called automatically by Terraform user_data on first boot.
# Can also be run manually: sudo bash ec2-setup.sh "owner/repo"
set -euo pipefail

GITHUB_REPO="${1:?Usage: sudo bash ec2-setup.sh owner/repo}"
EC2_USER="ec2-user"
DATA_DIR="/opt/wp-bot"

echo "==> [1/7] Install Docker + Compose plugin + jq"
dnf update -y
dnf install -y docker jq
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
systemctl enable --now docker
usermod -aG docker "${EC2_USER}"

echo "==> [2/7] Create data directories"
mkdir -p "${DATA_DIR}"/{data,media,model-cache}
chown -R 1000:1000 "${DATA_DIR}"/{data,media,model-cache}

echo "==> [3/7] Create 1 GB swap"
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> [4/7] Create docker-compose.yml"
cat > "${DATA_DIR}/docker-compose.yml" << COMPOSE
services:
  wp-bot:
    image: ghcr.io/${GITHUB_REPO}:latest
    container_name: wp-bot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ${DATA_DIR}/data:/app/data
      - ${DATA_DIR}/media:/app/media
      - ${DATA_DIR}/model-cache:/app/model-cache
    env_file:
      - /etc/wp-bot.env
    environment:
      - PORT=3000
      - XENOVA_CACHE_DIR=/app/model-cache
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    stop_signal: SIGTERM
    stop_grace_period: 30s
COMPOSE

echo "==> [5/7] Create /etc/wp-bot.env placeholder"
if [ ! -f /etc/wp-bot.env ]; then
  cat > /etc/wp-bot.env << 'ENV'
API_KEY=REPLACE_WITH_YOUR_API_KEY
ENV
  chown root:${EC2_USER} /etc/wp-bot.env
  chmod 640 /etc/wp-bot.env
fi

echo "==> [6/7] Install wp CLI"
curl -fsSL "https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/wp-cli.sh" \
  -o /usr/local/bin/wp
chmod +x /usr/local/bin/wp

echo "==> [7/7] Enable Docker log rotation"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DAEMON'
{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}
DAEMON
systemctl restart docker

echo ""
echo "Done. Next steps:"
echo "  1. Edit /etc/wp-bot.env with your API_KEY"
echo "  2. Re-login for docker group: exit && ssh ..."
echo "  3. Push a commit to main to trigger the first deploy"
echo "  4. Then: wp pair <phone>  to link your WhatsApp account"
