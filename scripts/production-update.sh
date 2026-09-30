#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${CASTLINK_ROOT:-/opt/studiolink}"
COMPOSE_FILE="${CASTLINK_COMPOSE_FILE:-$ROOT/infrastructure/production/docker-compose.yml}"
DATA_DIR="${CASTLINK_DATA_DIR:-$ROOT/data}"
BACKUP_ROOT="${CASTLINK_BACKUP_DIR:-$ROOT/backups}"
NEW_IMAGE="${1:-}"

if [[ -z "$NEW_IMAGE" ]]; then
  echo "usage: $0 <immutable-web-image>" >&2
  exit 2
fi
if [[ "$NEW_IMAGE" == *":latest" ]]; then
  echo "refusing mutable :latest image" >&2
  exit 2
fi

cd "$ROOT"
export CASTLINK_WEB_IMAGE="$NEW_IMAGE"

node scripts/production-preflight.mjs "$(dirname "$COMPOSE_FILE")"
docker image inspect "$NEW_IMAGE" >/dev/null

OLD_IMAGE="$(docker inspect studiolink-web --format '{{.Config.Image}}' 2>/dev/null || true)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_ROOT/pre-update-$STAMP"
mkdir -p "$BACKUP_ROOT"

node scripts/storage-backup.mjs   --data-dir "$DATA_DIR"   --output "$BACKUP"   --config "$COMPOSE_FILE"

echo "$OLD_IMAGE" > "$BACKUP/previous-web-image.txt"

docker compose -f "$COMPOSE_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" up -d postgres web

healthy=0
for _ in $(seq 1 36); do
  status="$(docker inspect studiolink-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    healthy=1
    break
  fi
  sleep 5
done

if [[ "$healthy" != "1" ]]; then
  echo "new web image did not become healthy; rolling back" >&2
  if [[ -n "$OLD_IMAGE" ]]; then
    export CASTLINK_WEB_IMAGE="$OLD_IMAGE"
    docker compose -f "$COMPOSE_FILE" up -d web || true
  fi
  exit 1
fi

curl -fsS http://127.0.0.1:"${CASTLINK_WEB_PORT:-3000}"/api/version
printf '\nupdate complete: %s\nbackup: %s\n' "$NEW_IMAGE" "$BACKUP"
