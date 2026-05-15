#!/usr/bin/env bash
# 在虚拟机内：于仓库根目录执行，或先 cd 到本脚本所在目录的上一级
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"
if [[ ! -f .env ]]; then
  echo "缺少 backend/.env，请先: cp .env.example .env 并填写 FABRIC_CRYPTO_BASE"
  exit 1
fi
npm install
npm run build
exec npm start
