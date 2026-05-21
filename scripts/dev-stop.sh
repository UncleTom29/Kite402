#!/bin/sh
set -eu

kill_if_listening() {
  port="$1"
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping listeners on port $port: $pids"
    kill $pids 2>/dev/null || true
  fi
}

kill_matching() {
  pattern="$1"
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    echo "Stopping processes matching: $pattern"
    pkill -f "$pattern" 2>/dev/null || true
  fi
}

kill_if_listening 3000
kill_if_listening 4000
kill_matching "tsup src/index.ts --format cjs,esm --watch"
kill_matching "ts-node-dev"
kill_matching "tsx watch src/server.ts"
kill_matching "next dev -p 3000"

echo "Stopping Docker infra"
docker compose down

echo "✅ Local dev services stopped"