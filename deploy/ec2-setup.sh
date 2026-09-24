#!/usr/bin/env bash
# One-time setup of Docker + Docker Compose on an Amazon Linux 2023 EC2 instance.
# Usage (on the instance):  bash deploy/ec2-setup.sh   then log out and back in.
set -euo pipefail

if ! command -v dnf >/dev/null; then
  echo "This script targets Amazon Linux 2023. On Ubuntu use: curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi

sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# Docker Compose v2 CLI plugin
ARCH=$(uname -m)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Buildx (needed by recent compose versions for `--build`)
BUILDX_VER=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | grep -oP '"tag_name":\s*"\K[^"]+')
case "$ARCH" in x86_64) BX=amd64 ;; aarch64) BX=arm64 ;; *) BX=$ARCH ;; esac
sudo curl -fsSL "https://github.com/docker/buildx/releases/download/${BUILDX_VER}/buildx-${BUILDX_VER}.linux-${BX}" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

docker --version
sudo docker compose version
echo "Done. Log out and back in (so your user can run docker without sudo), then follow the README."
