#!/usr/bin/env bash
# Phần của dự án: khởi động app tạm cho target "ci". Thoát 0 khi app đã sẵn sàng.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p ci/logs
PORT="${PORT:-4310}" DEMO_TEST_API=1 DEMO_BUG="${DEMO_BUG:-}" nohup node app/server.mjs > ci/logs/app.log 2>&1 &
echo $! > ci/logs/app.pid
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT:-4310}/health" > /dev/null && exit 0
  sleep 0.2
done
echo "app không lên sau 10 giây" >&2
exit 1
