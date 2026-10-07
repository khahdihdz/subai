#!/usr/bin/env bash
set -euo pipefail
apt-get update
apt-get install -y curl ffmpeg ca-certificates
if ! command -v node >/dev/null; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; fi
npm install --omit=dev
mkdir -p storage/{uploads,audio,subtitles,voice,output,temp}
[ -f .env ] || cp .env.example .env
echo 'Cài đặt xong. Sửa .env rồi chạy ./start.sh'