#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${CASTLINK_ROOT:-/opt/studiolink}"
COMPOSE_FILE="${CASTLINK_COMPOSE_FILE:-$ROOT/infrastructure/production/docker-compose.yml}"
BACKUP="${1:-}"
CONFIRM="${2:-}"

if [[ -z "$BACKUP" || "$CONFIRM" != "--confirm-replace" ]]; then
  echo "usage: $0 <backup.dump> --confirm-replace" >&2
  exit 2
fi
if [[ ! -s "$BACKUP" ]]; then
  echo "backup not found or empty: $BACKUP" >&2
  exit 2
fi

if [[ -f "$BACKUP.sha256" ]]; then
  (cd "$(dirname "$BACKUP")" && sha256sum -c "$(basename "$BACKUP.sha256")")
fi

running="$(docker inspect studiolink-web --format '{{.State.Running}}' 2>/dev/null || true)"
if [[ "$running" == "true" ]]; then
  echo "refusing restore while studiolink-web is running; stop web first" >&2
  exit 3
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc '
  pg_restore --list >/dev/null
' < "$BACKUP"

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc '
  set -eu
  test -n "$POSTGRES_USER"
  pg_restore --clean --if-exists --create --no-owner --no-acl -U "$POSTGRES_USER" -d postgres
' < "$BACKUP"

echo "PostgreSQL restore complete."
echo "Start web and verify /api/version, /api/health and tenant room access."
