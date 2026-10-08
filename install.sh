#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

if [ "$(id -u)" -ne 0 ]; then
  echo "Hãy chạy script bằng root: sudo ./install.sh"
  exit 1
fi

echo "==> Cập nhật hệ thống"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y curl ffmpeg ca-certificates git

echo "==> Cài Node.js 20"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

echo "==> Kiểm tra Node/npm"
node --version
npm --version
ffmpeg -version | head -n 1

echo "==> Cài dependencies"
npm install --omit=dev

echo "==> Tạo storage"
mkdir -p storage/{uploads,audio,subtitles,voice,output,temp}
chmod +x ./*.sh

echo "==> Tạo .env"
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "==> Cấu hình systemd"
install -m 644 subai.service /etc/systemd/system/subai.service
systemctl daemon-reload
systemctl enable subai

echo
echo "=========================================="
echo " SUBAI INSTALL HOÀN TẤT"
echo "=========================================="
echo "1. Sửa API key:"
echo "   nano $APP_DIR/.env"
echo
echo "2. Khởi động:"
echo "   systemctl start subai"
echo
echo "3. Kiểm tra:"
echo "   systemctl status subai --no-pager"
echo "   curl http://127.0.0.1:3000/health"
echo
echo "4. Log:"
echo "   journalctl -u subai -f"
echo
echo "VPS khuyến nghị: 2 CPU / 2 GB RAM / 25 GB NVMe"
echo "Upload tối đa: 1 GB | Video tối đa: 3 giờ"
