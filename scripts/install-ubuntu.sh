#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/studiolink"
IMAGE=""
DOMAIN=""
MODE="public"
LICENSE_TOKEN=""
LICENSE_SERVICE_URL="https://license.castlink.example"

usage() {
  cat <<'EOF'
Usage:
  sudo bash scripts/install-ubuntu.sh --image <immutable-image> [--mode public|edge] [--domain castlink.example] [--license <activation-token>] [--root /opt/studiolink]

The script prepares local CastLink production files. It does not publish DNS,
open firewall ports, or install a production signing private key.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="${2:-}"; shift 2 ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --license) LICENSE_TOKEN="${2:-}"; shift 2 ;;
    --license-service) LICENSE_SERVICE_URL="${2:-}"; shift 2 ;;
    --root) ROOT="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$IMAGE" ]]; then echo "--image is required" >&2; exit 2; fi
if [[ "$MODE" != "public" && "$MODE" != "edge" ]]; then echo "--mode must be public or edge" >&2; exit 2; fi
if [[ "$IMAGE" == *":latest" ]]; then echo "refusing mutable :latest image" >&2; exit 2; fi
if [[ "$(id -u)" -ne 0 ]]; then echo "run installer as root (sudo)" >&2; exit 2; fi
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 2; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required" >&2; exit 2; }
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 2; }

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROD_SRC="$SOURCE_ROOT/infrastructure/production"
PROD_DST="$ROOT/infrastructure/production"

if [[ "$ROOT" != /* || "$ROOT" == "/" ]]; then echo "--root must be an absolute non-root directory" >&2; exit 2; fi
if [[ -e "$PROD_DST/web.env" || -e "$PROD_DST/postgres.env" || -e "$ROOT/data/installation.json" || -e "$ROOT/install-state.json" ]]; then
  echo "Refusing to overwrite an existing installation. Use the update/migration workflow." >&2
  exit 2
fi
mkdir -p "$PROD_DST" "$ROOT/data" "$ROOT/postgres" "$ROOT/backups"
chmod 700 "$ROOT/data" "$ROOT/postgres" "$ROOT/backups"
install -m 0644 "$PROD_SRC/docker-compose.yml" "$PROD_DST/docker-compose.yml"

uuid() {
  if command -v uuidgen >/dev/null; then uuidgen | tr '[:upper:]' '[:lower:]'
  else
    python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
  fi
}

secret() { openssl rand -base64 48 | tr -d '\n'; }
dbpass() { openssl rand -hex 24; }

INSTALLATION_ID="$(uuid)"
POSTGRES_PASSWORD="$(dbpass)"
LIVEKIT_API_KEY="lk_$(openssl rand -hex 8)"
LIVEKIT_API_SECRET="$(openssl rand -hex 32)"
SESSION_SECRET="$(secret)"
DATA_KEY="$(secret)"
SERVER_ID="srv-$(openssl rand -hex 16)"
NODE_SECRET="$(openssl rand -hex 32)"
SETUP_TOKEN="$(openssl rand -hex 32)"

cat > "$PROD_DST/postgres.env" <<EOF
POSTGRES_USER=castlink
POSTGRES_DB=castlink
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

cat > "$PROD_DST/web.env" <<EOF
NODE_ENV=production
STUDIOLINK_DATA_DIR=/data
STUDIOLINK_INSTALLATION_ID=$INSTALLATION_ID
STUDIOLINK_DEFAULT_STUDIO_ID=studio-default

CASTLINK_STORAGE_BACKEND=json
DATABASE_URL=postgresql://castlink:$POSTGRES_PASSWORD@postgres:5432/castlink

LIVEKIT_SERVER_URL=http://host.docker.internal:7880
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET

STUDIOLINK_STUDIO_PASSWORD_HASH=CHANGE_ME_AFTER_FIRST_SETUP
CASTLINK_SESSION_SECRET=$SESSION_SECRET
CASTLINK_DATA_ENCRYPTION_KEY=$DATA_KEY

CASTLINK_TURN_HEALTH_HOST=${DOMAIN:+turn.}$DOMAIN
CASTLINK_TURN_TLS_PORT=443
CASTLINK_HEALTH_TIMEOUT_MS=1500
STUDIOLINK_STATS_MAX_BYTES=536870912

CASTLINK_LICENSE_ENFORCE=0
CASTLINK_SETUP_TOKEN=$SETUP_TOKEN
CASTLINK_SERVER_ID=$SERVER_ID
CASTLINK_SERVER_LEASE=
CASTLINK_LICENSE_TOKEN=$LICENSE_TOKEN
CASTLINK_LICENSE_SERVICE_URL=$LICENSE_SERVICE_URL

CASTLINK_NODE_ID=$SERVER_ID
CASTLINK_NODE_SECRET=$NODE_SECRET
CASTLINK_NODE_REGION=${DOMAIN:-local}
CASTLINK_NODE_TYPE=self-hosted
CASTLINK_CONTROL_PLANE_URL=https://api.castlink.example
CASTLINK_CONTROL_PLANE_TIMEOUT_MS=5000
EOF

cat > "$PROD_DST/livekit.yaml" <<EOF
port: 7880
log_level: info
rtc:
  tcp_port: 7881
  port_range_start: 61000
  port_range_end: 61100
  use_external_ip: true
keys:
  $LIVEKIT_API_KEY: $LIVEKIT_API_SECRET
EOF

chmod 600 "$PROD_DST/web.env" "$PROD_DST/postgres.env" "$PROD_DST/livekit.yaml"

cat > "$ROOT/install-state.json" <<EOF
{
  "schemaVersion": 1,
  "installationId": "$INSTALLATION_ID",
  "serverId": "$SERVER_ID",
  "mode": "$MODE",
  "domain": "$DOMAIN",
  "image": "$IMAGE",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
chmod 600 "$ROOT/install-state.json"

printf '%s\n' "$SETUP_TOKEN" > "$ROOT/setup-token.txt"
chmod 600 "$ROOT/setup-token.txt"

cat > "$ROOT/.castlink-release" <<EOF
CASTLINK_WEB_IMAGE=$IMAGE
CASTLINK_ROOT=$ROOT
CASTLINK_DATA_DIR=$ROOT/data
CASTLINK_POSTGRES_DATA_DIR=$ROOT/postgres
EOF
chmod 600 "$ROOT/.castlink-release"

echo
echo "CastLink bootstrap prepared."
echo "Root: $ROOT"
echo "Installation ID: $INSTALLATION_ID"
echo "Server ID: $SERVER_ID"
echo "Mode: $MODE"
echo "Setup token file: $ROOT/setup-token.txt"
echo
echo "Next:"
if [[ "$MODE" == "edge" ]]; then
  echo "1. Register this edge node with CastLink Cloud before accepting external guests"
else
  echo "1. Start the generated LiveKit media service and provision TLS/TURN for your domain"
fi
echo "2. Set the studio password hash via setup/installer flow"
echo "3. Run production preflight"
echo "4. Start/update using scripts/production-update.sh"
echo
echo "No generated secret values were printed."
