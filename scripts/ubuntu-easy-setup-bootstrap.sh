#!/usr/bin/env bash
# Invoked through the operator's verified SSH connection, never curl | sh.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset DOCKER_HOST DOCKER_CONTEXT

check_platform() {
  [[ $(id -u) == 0 ]] || { echo 'Use root for this VPS preparation.' >&2; return 3; }
  # This file belongs to the selected, trusted server OS.
  . /etc/os-release
  [[ ${ID:-} == ubuntu && ( ${VERSION_ID:-} == 22.04 || ${VERSION_ID:-} == 24.04 ) && $(uname -m) == x86_64 ]] || {
    echo 'Easy Setup supports Ubuntu 22.04/24.04 x86_64 for this release.' >&2; return 3;
  }
  command -v python3 >/dev/null || { apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y python3; }
}
compose_supported() {
  [[ $1 =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+)([-+].*)?$ ]] || return 1
  local major=$((10#${BASH_REMATCH[1]})) minor=$((10#${BASH_REMATCH[2]})) patch=$((10#${BASH_REMATCH[3]}))
  (( major > 2 || major == 2 && (minor > 23 || minor == 23 && patch >= 1) ))
}
runtime_ready() {
  command -v docker >/dev/null || return 1
  local kind version
  kind=$(timeout 15 docker --host unix:///var/run/docker.sock info --format '{{.OSType}}' 2>/dev/null) || return 1
  [[ $kind == linux ]] || return 1
  version=$(timeout 15 docker compose version --short 2>/dev/null) || return 1
  compose_supported "$version"
}
install_runtime() {
  local engine_present=0 version='' keyfile
  command -v docker >/dev/null && engine_present=1
  if (( engine_present )); then
    version=$(docker compose version --short 2>/dev/null) || version=''
  fi
  if (( ! engine_present )) || ! compose_supported "$version"; then
    # Keep existing engines. If only Compose is missing, install only its plugin.
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl
    if ! apt-cache show docker-compose-plugin >/dev/null 2>&1; then
      install -d -m 0755 /etc/apt/keyrings
      keyfile=$(mktemp)
      if ! curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://download.docker.com/linux/ubuntu/gpg -o "$keyfile"; then rm -f "$keyfile"; return 3; fi
      install -m 0644 "$keyfile" /etc/apt/keyrings/castlink-docker.asc
      rm -f "$keyfile"
      printf 'deb [arch=amd64 signed-by=/etc/apt/keyrings/castlink-docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$VERSION_CODENAME" > /etc/apt/sources.list.d/castlink-docker.list
      apt-get update
    fi
    if (( engine_present )); then
      DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin
    else
      DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
  fi
  # Starting a stopped service is explicit install-mode work; never restart one.
  if ! systemctl is-active --quiet docker; then systemctl start docker; fi
}
prepare_scope() {
  if [[ ! -e /opt/castlink && ! -L /opt/castlink ]]; then
    (umask 077; mkdir /opt/castlink)
  fi
  [[ -d /opt/castlink && ! -L /opt/castlink && $(stat -c '%u:%a' /opt/castlink) == 0:700 ]] || {
    echo '/opt/castlink already exists with incompatible ownership or mode. It was not changed. Choose a separate private scope in the advanced CLI.' >&2; return 3;
  }
}
main() {
  local action=${1:-check}
  [[ $# == 1 && ( $action == check || $action == prepare || $action == install ) ]] || return 2
  check_platform
  if ! runtime_ready; then
    if [[ $action != install ]]; then echo 'Docker Engine or Compose >= 2.23.1 is not ready.'; return 10; fi
    install_runtime
    runtime_ready || { echo 'Docker is still unavailable. Check the VPS service logs before continuing.' >&2; return 3; }
  fi
  if [[ $action != check ]]; then prepare_scope; fi
  echo 'VPS runtime is ready. This does not deploy CastLink or verify HTTPS/media.'
}
if [[ ${BASH_SOURCE[0]:-} == "$0" || $0 == bash ]]; then main "$@"; fi
