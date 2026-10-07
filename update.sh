#!/usr/bin/env bash
set -euo pipefail
git pull --ff-only
npm install --omit=dev
systemctl restart subai 2>/dev/null || true