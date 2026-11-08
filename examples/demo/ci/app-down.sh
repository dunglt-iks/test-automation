#!/usr/bin/env bash
# Phần của dự án: tắt app tạm.
cd "$(dirname "$0")/.."
[ -f ci/logs/app.pid ] && kill "$(cat ci/logs/app.pid)" 2>/dev/null
rm -f ci/logs/app.pid
exit 0
