#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bun install --frozen-lockfile
bun run build
docker volume create tavern_tavern_node_modules >/dev/null
docker run --rm \
    -v "$PWD:/app" \
    -v tavern_tavern_node_modules:/app/node_modules \
    -w /app \
    oven/bun:1.3.5-alpine \
    sh -lc 'bun install --frozen-lockfile'
docker compose -p tavern --env-file .env -f compose.yml up -d --wait --remove-orphans
