#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${CASTLINK_ROOT:-/opt/studiolink}"
COMPOSE_FILE="${CASTLINK_COMPOSE_FILE:-$ROOT/infrastructure/production/docker-compose.yml}"
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

valid_owned_image() {
  [[ "$1" =~ ^studiolink_web:[0-9][A-Za-z0-9._-]*$ || "$1" =~ ^castlink-easy-web:[a-f0-9]{40}$ ]] && [[ "$2" =~ ^sha256:[a-f0-9]{64}$ ]]
}
# A small ownership/cleanup receipt, never a copy of configuration or user data.
# Pending entries survive failed updates, stopped containers and failed removals.
RECEIPT="$ROOT/.castlink-production-images.tsv"
pending_tags=()
pending_ids=()
queue_image() {
  local tag="$1" identity="$2" i
  valid_owned_image "$tag" "$identity" || return 0
  for i in "${!pending_tags[@]}"; do
    if [[ "${pending_tags[$i]}" == "$tag" ]]; then return 0; fi
  done
  pending_tags+=("$tag")
  pending_ids+=("$identity")
}
if [[ -L "$RECEIPT" ]]; then echo 'refusing symlink image receipt' >&2; exit 2; fi
if [[ -f "$RECEIPT" ]]; then
  {
    IFS= read -r schema
    IFS= read -r compose_scope
    if [[ "$schema" != castlink-production-images-v1 || "$compose_scope" != "$COMPOSE_FILE" ]]; then
      echo 'image receipt belongs to another installation or schema' >&2
      exit 2
    fi
    while IFS=$'\t' read -r tag identity extra; do
      if [[ -n "$extra" ]] || ! valid_owned_image "$tag" "$identity"; then
        echo 'invalid pending image receipt entry' >&2
        exit 2
      fi
      queue_image "$tag" "$identity"
      if (( ${#pending_tags[@]} > 128 )); then echo 'pending image receipt limit exceeded' >&2; exit 2; fi
    done
  } < "$RECEIPT"
fi
save_pending_images() {
  local temporary i
  temporary="$(mktemp "$RECEIPT.XXXXXX")" || return 1
  if ! {
    printf 'castlink-production-images-v1\n%s\n' "$COMPOSE_FILE"
    for i in "${!pending_tags[@]}"; do printf '%s\t%s\n' "${pending_tags[$i]}" "${pending_ids[$i]}"; done
  } > "$temporary"; then rm -f -- "$temporary"; return 1; fi
  if ! mv -f -- "$temporary" "$RECEIPT"; then rm -f -- "$temporary"; return 1; fi
}

# Keep exact working identities until replacement services and HTTP are verified.
OLD_IMAGE="$(docker inspect studiolink-web --format '{{.Config.Image}}' 2>/dev/null || true)"
OLD_ID="$(docker inspect studiolink-web --format '{{.Image}}' 2>/dev/null || true)"
queue_image "$OLD_IMAGE" "$OLD_ID"
converter_container="$(docker compose -f "$COMPOSE_FILE" ps -q presentation-converter 2>/dev/null || true)"
if [[ -n "$converter_container" ]]; then
  old_converter_image="$(docker inspect "$converter_container" --format '{{.Config.Image}}' 2>/dev/null || true)"
  old_converter_id="$(docker inspect "$converter_container" --format '{{.Image}}' 2>/dev/null || true)"
  queue_image "$old_converter_image" "$old_converter_id"
fi
# A failed candidate can be retired after a future healthy update as well.
new_id="$(docker image inspect "$NEW_IMAGE" --format '{{.Id}}')"
queue_image "$NEW_IMAGE" "$new_id"
save_pending_images

docker compose -f "$COMPOSE_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" up -d postgres presentation-converter web

healthy=0
for _ in $(seq 1 36); do
  status="$(docker inspect studiolink-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    healthy=1
    for service in postgres presentation-converter; do
      service_container="$(docker compose -f "$COMPOSE_FILE" ps -q "$service")"
      if [[ -z "$service_container" ]]; then healthy=0; break; fi
      service_state="$(docker inspect "$service_container" --format '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
      if [[ "$service_state" != 'true|healthy' && "$service_state" != 'true|none' ]]; then healthy=0; break; fi
    done
    if [[ "$healthy" == 1 ]]; then break; fi
  fi
  sleep 5
done

if [[ "$healthy" != "1" ]]; then
  echo "new service set did not become healthy; rolling back" >&2
  if [[ -n "$OLD_IMAGE" ]]; then
    export CASTLINK_WEB_IMAGE="$OLD_IMAGE"
    rollback_services=(web)
    if docker run --rm --pull never --network none --read-only --entrypoint /bin/sh "$OLD_IMAGE" -c 'test -r /app/scripts/presentation-converter/server.py' >/dev/null 2>&1; then
      rollback_services=(presentation-converter web)
    else
      docker compose -f "$COMPOSE_FILE" stop presentation-converter || true
    fi
    docker compose -f "$COMPOSE_FILE" up -d "${rollback_services[@]}" || true
  fi
  exit 1
fi

curl -fsS http://127.0.0.1:"${CASTLINK_WEB_PORT:-3000}"/api/version

retire_previous_image() {
  local tag="$1" expected="$2" actual used container configured
  [[ "$tag" != "$NEW_IMAGE" ]] || return 0
  actual="$(docker image inspect "$tag" --format '{{.Id}}' 2>/dev/null)" || return 1
  [[ "$actual" == "$expected" ]] || return 1
  # Includes stopped containers and other installations. Never force or prune.
  used="$(docker ps -aq --filter "ancestor=$tag")" || return 1
  while IFS= read -r container; do
    [[ -n "$container" ]] || continue
    configured="$(docker inspect "$container" --format '{{.Config.Image}}')" || return 1
    [[ -n "$configured" && "$configured" != "$tag" ]] || return 1
  done <<< "$used"
  docker image rm "$tag"
}
retained_tags=()
retained_ids=()
for i in "${!pending_tags[@]}"; do
  if ! retire_previous_image "${pending_tags[$i]}" "${pending_ids[$i]}"; then
    retained_tags+=("${pending_tags[$i]}")
    retained_ids+=("${pending_ids[$i]}")
    echo "healthy update complete; previous image retained for later cleanup: ${pending_tags[$i]}" >&2
  fi
done
pending_tags=("${retained_tags[@]}")
pending_ids=("${retained_ids[@]}")
save_pending_images || echo 'healthy update complete; pending cleanup receipt retained for retry' >&2
printf '\nupdate complete: %s\n' "$NEW_IMAGE"
