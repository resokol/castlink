# syntax=docker/dockerfile:1
# Manufacturer-only build. Docker and its image archive never enter the WSL OS.
ARG WEB_IMAGE
FROM ${WEB_IMAGE} AS web
FROM docker.io/livekit/livekit-server@sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3 AS livekit
FROM docker.io/library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d AS caddy
FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852 AS rootfs
ARG DEBIAN_FRONTEND=noninteractive
# No service is started, database initialized or machine identity generated here.
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod 755 /usr/sbin/policy-rc.d \
 && sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources \
 && apt-get update && apt-get install -y --no-install-recommends \
    systemd systemd-sysv dbus ca-certificates curl openssl python3 \
    postgresql-16 haproxy nftables iproute2 procps libstdc++6 \
    libreoffice-impress fonts-dejavu-core fonts-liberation \
 # Refresh packages left in the pinned base: superseded binary versions can
 # disappear from source indexes even while still installed in that base.
 && apt-get upgrade -y --no-install-recommends \
 && pg_dropcluster --stop 16 main \
 && systemctl mask postgresql.service postgresql@16-main.service haproxy.service \
 && rm -f /usr/sbin/policy-rc.d
# WSL opens a PAM-backed systemd user session before executing the first command.
# Keep this small layer separate so existing OS/dependency build caches remain valid.
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod 755 /usr/sbin/policy-rc.d \
 && apt-get install -y --no-install-recommends libpam-systemd dbus-user-session \
 && rm -f /usr/sbin/policy-rc.d
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=web /usr/local/LICENSE /opt/castlink/third_party/node/LICENSE
COPY --from=web /app/ /opt/castlink/app/
COPY --from=livekit /livekit-server /usr/local/bin/livekit-server
COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy
COPY --chmod=0755 scripts/server-wsl-runtime.py /usr/local/bin/castlink-server
COPY --chmod=0644 infrastructure/server-wsl/*.service infrastructure/server-wsl/*.target /etc/systemd/system/
COPY --chmod=0644 infrastructure/server-wsl/castlink.sysusers /usr/lib/sysusers.d/castlink.conf
COPY --chmod=0644 infrastructure/server-wsl/health.mjs infrastructure/server-wsl/setup-web.mjs infrastructure/server-wsl/castlink-private-ports.nft /usr/lib/castlink-server/
COPY --chmod=0644 scripts/presentation-converter/server.py /opt/castlink/app/scripts/presentation-converter/server.py
COPY --chmod=0644 scripts/collect-server-wsl-sources.py /usr/lib/castlink-server/collect-sources.py
COPY --chmod=0644 LICENSE THIRD_PARTY_NOTICES /opt/castlink/
ARG CASTLINK_SOURCE_COMMIT
ARG CASTLINK_VERSION
RUN test -n "$CASTLINK_VERSION" && test "${#CASTLINK_SOURCE_COMMIT}" = 40 \
 && systemd-sysusers && chmod -R a+rX /opt/castlink/app \
 && chmod 0755 /usr/lib/castlink-server \
 && printf '{"schemaVersion":1,"version":"%s","commit":"%s","buildId":"%s-%s"}\n' \
      "$CASTLINK_VERSION" "$CASTLINK_SOURCE_COMMIT" "$CASTLINK_VERSION" "$(printf %.12s "$CASTLINK_SOURCE_COMMIT")" > /opt/castlink/release.json \
 && printf '[boot]\nsystemd=true\n\n[user]\ndefault=root\n\n[automount]\nenabled=false\n\n[interop]\nenabled=false\nappendWindowsPath=false\n' > /etc/wsl.conf \
 && dpkg-query -W -f='${source:Package}\t${source:Version}\n' | sort -u > /opt/castlink/packages.tsv \
 && rm -f /etc/machine-id /var/lib/dbus/machine-id /root/.bash_history \
 && touch /etc/machine-id \
 && rm -rf /var/lib/postgresql/16 /var/lib/castlink-server /var/log/* /tmp/* /var/tmp/* \
 && /usr/local/bin/node --version && /usr/local/bin/livekit-server --version && /usr/local/bin/caddy version \
 && python3 -m py_compile /usr/local/bin/castlink-server \
 && systemd-analyze verify /etc/systemd/system/castlink-*.service /etc/systemd/system/castlink-server.target
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]

# Matching Ubuntu source archives are a separate optional download for users.
# They are mandatory inputs to release packaging. No source collection on a PC.
FROM rootfs AS sources
RUN python3 /usr/lib/castlink-server/collect-sources.py /opt/castlink-sources \
 && tar -czf /opt/CastLink-Server-WSL-Sources.tar.gz -C /opt/castlink-sources .
