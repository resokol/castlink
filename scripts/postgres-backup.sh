#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${CASTLINK_ROOT:-/opt/studiolink}"
COMPOSE_FILE="${CASTLINK_COMPOSE_FILE:-$ROOT/infrastructure/production/docker-compose.yml}"
OUTPUT="${1:-}"

if [[ -z "$OUTPUT" ]]; then
  echo "usage: $0 <output.dump>" >&2
  exit 2
fi
if [[ "$OUTPUT" == "/" || "$OUTPUT" == "." ]]; then
  echo "invalid backup path" >&2
  exit 2
fi

mkdir -p "$(dirname "$OUTPUT")"
TMP="$OUTPUT.tmp.$$"
trap 'rm -f "$TMP"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc '
  set -eu
  test -n "$POSTGRES_USER"
  test -n "$POSTGRES_DB"
  pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"
' > "$TMP"

if [[ ! -s "$TMP" ]]; then
  echo "PostgreSQL backup is empty" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc '
  pg_restore --list >/dev/null
' < "$TMP"

mv "$TMP" "$OUTPUT"
chmod 600 "$OUTPUT"
sha256sum "$OUTPUT" > "$OUTPUT.sha256"
chmod 600 "$OUTPUT.sha256"
trap - EXIT

echo "PostgreSQL backup complete: $OUTPUT"
echo "Checksum: $OUTPUT.sha256"
