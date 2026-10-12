#!/bin/sh
# Caddy owns ACME and its storage. This process only reads the selected TURN cert.
set -eu
umask 077
host=${CASTLINK_TURN_HOST:-}
case "$host" in ''|*[!a-z0-9.-]*|.*|*..*|*.) echo 'Invalid TURN domain' >&2; exit 2;; esac
[ "${#host}" -le 253 ] && echo "$host" | grep -Eq '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$' || { echo 'Invalid TURN domain' >&2; exit 2; }
runtime=/run/castlink-turn-tls
mkdir -p "$runtime"

certificate() {
  for issuer in /data/caddy/certificates/*; do
    cert="$issuer/$host/$host.crt"; key="$issuer/$host/$host.key"
    [ -f "$cert" ] && [ -f "$key" ] || continue
    # A renewal may replace either file between reads; copy both, then validate.
    cat "$cert" > "$runtime/candidate.crt"
    cat "$key" > "$runtime/candidate.key"
    openssl x509 -in "$runtime/candidate.crt" -noout -checkhost "$host" >/dev/null 2>&1 || continue
    openssl x509 -in "$runtime/candidate.crt" -noout -checkend 60 >/dev/null 2>&1 || continue
    openssl verify -CAfile /etc/ssl/cert.pem -untrusted "$runtime/candidate.crt" "$runtime/candidate.crt" >/dev/null 2>&1 || continue
    openssl x509 -in "$runtime/candidate.crt" -pubkey -noout > "$runtime/cert.pub" || continue
    openssl pkey -in "$runtime/candidate.key" -pubout > "$runtime/key.pub" 2>/dev/null || continue
    cmp -s "$runtime/cert.pub" "$runtime/key.pub" || continue
    cat "$runtime/candidate.crt" "$runtime/candidate.key" > "$runtime/candidate.pem"
    fingerprint=$(sha256sum "$runtime/candidate.pem" | cut -d ' ' -f 1)
    pem="$runtime/$fingerprint.pem"
    mv "$runtime/candidate.pem" "$pem"
    return 0
  done
  return 1
}

configuration() {
  cat <<EOF
global
  log stdout format raw local0
  master-worker
  stats socket $runtime/admin.sock mode 600 level admin expose-fd listeners
defaults
  mode tcp
  log global
  timeout connect 5s
  timeout client 1h
  timeout server 1h
resolvers docker
  nameserver dns 127.0.0.11:53
  resolve_retries 3
  timeout resolve 1s
  timeout retry 1s
  hold valid 10s
frontend public_tls
  bind :443
  tcp-request inspect-delay 5s
  tcp-request content accept if { req.ssl_hello_type 1 }
  use_backend turn_entry if { req.ssl_sni -i $host }
  default_backend web_tls
backend web_tls
  server caddy caddy:8443 send-proxy-v2 resolvers docker init-addr last,libc,none check
backend turn_entry
  server terminate 127.0.0.1:5348 send-proxy-v2
EOF
  if [ -n "${pem:-}" ]; then
    cat <<EOF
frontend turn_tls
  bind 127.0.0.1:5348 ssl crt $pem accept-proxy ssl-min-ver TLSv1.2
  default_backend livekit_turn
backend livekit_turn
  server livekit livekit:5349 send-proxy-v2 resolvers docker init-addr last,libc,none check
EOF
  fi
}

case "${1:-run}" in
  check) certificate; exit $?;;
  health)
    [ -s "$runtime/ready" ] || exit 1
    # Check the actual published listener and the selected LiveKit backend.
    openssl s_client -connect 127.0.0.1:443 -servername "$host" -verify_return_error -verify_hostname "$host" -CAfile /etc/ssl/cert.pem </dev/null >/dev/null 2>&1
    wget -q -T 3 -O /dev/null http://livekit:7880/ || exit 1
    exit 0;;
  run) ;;
  *) exit 2;;
esac
rm -f "$runtime/ready"
pem=''; previous=''
if certificate; then previous=$fingerprint; fi
configuration > "$runtime/haproxy.cfg"
haproxy -c -f "$runtime/haproxy.cfg" >/dev/null
haproxy -W -db -f "$runtime/haproxy.cfg" &
master=$!
[ -z "$pem" ] || echo ready > "$runtime/ready"
watch() {
  while kill -0 "$master" 2>/dev/null; do
    sleep 15 & wait $!
    if certificate; then
      if [ "$fingerprint" != "$previous" ]; then
        configuration > "$runtime/haproxy.new"
        if haproxy -c -f "$runtime/haproxy.new" >/dev/null 2>&1; then
          mv "$runtime/haproxy.new" "$runtime/haproxy.cfg"
          kill -USR2 "$master"
          previous=$fingerprint
          echo ready > "$runtime/ready"
          echo 'TURN TLS certificate loaded; existing relay sessions preserved'
        fi
      fi
      echo ready > "$runtime/ready"
    else
      # Do not advertise readiness after certificate expiry or storage failure.
      rm -f "$runtime/ready"
    fi
  done
}
watch & watcher=$!
stop() { kill "$watcher" "$master" 2>/dev/null || true; }
trap stop TERM INT EXIT
wait "$master"
