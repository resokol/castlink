#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${CASTLINK_ROOT:-/opt/studiolink}"
COMPOSE_FILE="${CASTLINK_COMPOSE_FILE:-$ROOT/infrastructure/production/docker-compose.yml}"
BACKUP="${1:-}"

if [[ -z "$BACKUP" ]]; then
  echo "usage: $0 <pre-update-backup-directory>" >&2
  exit 2
fi

IMAGE_FILE="$BACKUP/previous-web-image.txt"
if [[ ! -s "$IMAGE_FILE" ]]; then
  echo "previous image record not found: $IMAGE_FILE" >&2
  exit 2
fi

OLD_IMAGE="$(tr -d '\r\n' < "$IMAGE_FILE")"
if [[ -z "$OLD_IMAGE" ]]; then
  echo "previous image record is empty" >&2
  exit 2
fi

cd "$ROOT"
export CASTLINK_WEB_IMAGE="$OLD_IMAGE"
docker image inspect "$OLD_IMAGE" >/dev/null

rollback_services=(web)
if docker run --rm --pull never --network none --read-only --entrypoint /bin/sh "$OLD_IMAGE" -c 'test -r /app/scripts/presentation-converter/server.py' >/dev/null 2>&1; then
  rollback_services=(presentation-converter web)
else
  # Releases before the isolated converter keep their original web-only behavior.
  docker compose -f "$COMPOSE_FILE" stop presentation-converter
fi
docker compose -f "$COMPOSE_FILE" up -d "${rollback_services[@]}"

for _ in $(seq 1 36); do
  status="$(docker inspect studiolink-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    curl -fsS http://127.0.0.1:"${CASTLINK_WEB_PORT:-3000}"/api/version
    printf '\nrollback complete: %s\n' "$OLD_IMAGE"
    exit 0
  fi
  sleep 5
done

echo "rollback image did not become healthy" >&2
exit 1
