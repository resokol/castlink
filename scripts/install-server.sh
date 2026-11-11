#!/usr/bin/env bash
# Release template: package-server-bootstrap.mjs embeds Python and archive pins.
# The complete function must parse before a curl pipeline can perform any effect.
castlink_install_main() {
  set -euo pipefail
  umask 077
  local allow_runtime=0 option
  for option in "$@"; do
    case "$option" in
      -h|--help)
        cat <<'CASTLINK_HELP'
CastLink Linux server installer (Ubuntu 22.04/24.04 amd64)
Usage: bash install-server.sh [options]
  --state-dir PATH                 Persistent installation (default /opt/castlink-server)
  --install-runtime               Allow apt prerequisites and starting Docker
  --config FILE                   Existing Linux helper JSON configuration
  --room-creation-password-file FILE  UTF-8 password for unattended setup
  --owner-access-file FILE          Explicitly issue a private platform owner invitation
  --advanced                      Ask for advanced network settings
  --lang ru|en|zh-CN               Setup language (default ru)
Interactive setup reads /dev/tty, including when invoked through curl | bash.
An existing completed installation is retained without update or restart.
CASTLINK_HELP
        return 0
        ;;
      --install-runtime) allow_runtime=1 ;;
    esac
  done
  if ! command -v python3 >/dev/null 2>&1; then
    if [[ $allow_runtime != 1 ]]; then
      echo 'CastLink: Python 3 is required. Install it or rerun with --install-runtime.' >&2
      return 1
    fi
    if [[ $EUID != 0 ]] || ! ( . /etc/os-release; [[ $ID == ubuntu && ( $VERSION_ID == 22.04 || $VERSION_ID == 24.04 ) && $(uname -m) == x86_64 ]] ); then
      echo 'CastLink: prerequisites require root on Ubuntu 22.04/24.04 amd64.' >&2
      return 1
    fi
    DEBIAN_FRONTEND=noninteractive timeout 900 apt-get -o DPkg::Lock::Timeout=60 update
    DEBIAN_FRONTEND=noninteractive timeout 900 apt-get -o DPkg::Lock::Timeout=60 install -y python3 ca-certificates
  fi
  python3 -c "$(cat <<'CASTLINK_EMBEDDED_PYTHON'
@@CASTLINK_PYTHON@@
CASTLINK_EMBEDDED_PYTHON
)" "$@"
}
castlink_install_main "$@"
exit $?
