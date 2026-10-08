#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/subai"
REPO_URL="https://github.com/khahdihdz/subai.git"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Chạy bằng root: sudo bash install.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> [1/7] Cập nhật hệ thống"
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git ffmpeg

echo "==> [2/7] Cài Node.js 20"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> [3/7] Chuẩn bị source"
if [ ! -d "$APP_DIR/.git" ]; then
  rm -rf "$APP_DIR"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> [4/7] Cài Node dependencies"
npm install --omit=dev --no-audit --no-fund

echo "==> [5/7] Chuẩn bị cấu hình và storage"
mkdir -p storage/{uploads,audio,subtitles,voice,output,temp}
chmod +x ./*.sh
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "==> [6/7] Cấu hình systemd"
install -m 644 subai.service /etc/systemd/system/subai.service
systemctl daemon-reload
systemctl enable subai
systemctl restart subai

echo "==> [7/7] Kiểm tra"
sleep 2
if ! systemctl is-active --quiet subai; then
  echo "ERROR: SUBAI không khởi động được."
  systemctl status subai --no-pager || true
  journalctl -u subai -n 80 --no-pager || true
  exit 1
fi

if ! curl -fsS http://127.0.0.1:3000/health >/dev/null; then
  echo "ERROR: SUBAI chạy nhưng health check thất bại."
  journalctl -u subai -n 80 --no-pager || true
  exit 1
fi

echo
echo "=========================================="
echo " SUBAI CÀI ĐẶT THÀNH CÔNG"
echo "=========================================="
echo "App:       http://127.0.0.1:3000"
echo "Health:    http://127.0.0.1:3000/health"
echo "Directory: $APP_DIR"
echo
echo "VPS:       2 CPU / 2 GB RAM / 25 GB NVMe"
echo "Upload:    1 GB"
echo "Duration:  3 giờ"
echo "Queue:     1 video/job"
echo
echo "Sửa API key:"
echo "  nano $APP_DIR/.env"
echo
echo "Log:"
echo "  journalctl -u subai -f"
