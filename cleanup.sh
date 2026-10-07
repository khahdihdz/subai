#!/usr/bin/env bash
set -euo pipefail
find storage/temp storage/audio storage/voice -type f -mtime +1 -delete 2>/dev/null || true
find storage/uploads -type f -mtime +2 -delete 2>/dev/null || true