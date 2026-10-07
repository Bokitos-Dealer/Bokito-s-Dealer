#!/bin/sh
# Render episodes one after another (resumable: rerun this after a restart).
cd "$(dirname "$0")"
while pgrep -f "render.mjs solar-storm" >/dev/null; do sleep 20; done
for ep in "$@"; do
  node render.mjs "$ep" --workers 2 --resume --then-encode > "output/$ep/render.log" 2>&1
done
