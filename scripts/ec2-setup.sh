#!/usr/bin/env bash
# One-time setup for EC2 (Amazon Linux 2023).
# Called automatically by Terraform user_data on first boot.
# Can also be run manually: sudo bash ec2-setup.sh "owner/repo"
set -euo pipefail

GITHUB_REPO="${1:?Usage: sudo bash ec2-setup.sh owner/repo}"
EC2_USER="ec2-user"
EBS_DEVICE="/dev/xvdf"
MOUNT_POINT="/mnt/data"
COMPOSE_DIR="/opt/wp-bot"

echo "==> [1/9] Install Docker + Compose plugin + jq"
dnf update -y
dnf install -y docker jq
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
systemctl enable --now docker
usermod -aG docker "${EC2_USER}"

echo "==> [2/9] Format + mount EBS volume"
if ! blkid "${EBS_DEVICE}" &>/dev/null; then
  mkfs -t ext4 "${EBS_DEVICE}"
fi
mkdir -p "${MOUNT_POINT}"
EBS_UUID=$(blkid -s UUID -o value "${EBS_DEVICE}")
grep -q "${EBS_UUID}" /etc/fstab \
  || echo "UUID=${EBS_UUID} ${MOUNT_POINT} ext4 defaults,nofail 0 2" >> /etc/fstab
mount -a

echo "==> [3/9] Create data directories (owned by node uid=1000)"
mkdir -p "${MOUNT_POINT}"/{app-data,media,model-cache}
chown -R 1000:1000 "${MOUNT_POINT}"/{app-data,media,model-cache}

echo "==> [4/9] Create 1 GB swap"
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> [5/9] Create docker-compose.yml"
mkdir -p "${COMPOSE_DIR}"
cat > "${COMPOSE_DIR}/docker-compose.yml" << COMPOSE
services:
  wp-bot:
    image: ghcr.io/${GITHUB_REPO}:latest
    container_name: wp-bot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /mnt/data/app-data:/app/data
      - /mnt/data/media:/app/media
      - /mnt/data/model-cache:/app/model-cache
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

echo "==> [6/9] Create /etc/wp-bot.env placeholder"
if [ ! -f /etc/wp-bot.env ]; then
  cat > /etc/wp-bot.env << 'ENV'
API_KEY=REPLACE_WITH_YOUR_API_KEY
PHONE_NUMBER=90XXXXXXXXXX
ENV
  chmod 600 /etc/wp-bot.env
fi

echo "==> [7/9] Install wp CLI"
curl -fsSL "https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/wp-cli.sh" \
  -o /usr/local/bin/wp
chmod +x /usr/local/bin/wp

echo "==> [8/9] Enable Docker log rotation"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DAEMON'
{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}
DAEMON
systemctl restart docker

echo "==> [9/9] Done"
echo ""
echo "If running manually (not via Terraform user_data):"
echo "  1. Edit /etc/wp-bot.env with real API_KEY + PHONE_NUMBER"
echo "  2. Re-login for docker group: exit && ssh ..."
echo "  3. Push a commit to main to trigger the first deploy"
