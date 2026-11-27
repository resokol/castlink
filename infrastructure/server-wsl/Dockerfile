# syntax=docker/dockerfile:1
# Manufacturer-only build. Docker and its image archive never enter the WSL OS.
ARG WEB_IMAGE
FROM ${WEB_IMAGE} AS web
FROM docker.io/livekit/livekit-server@sha256:04668840140552c7e5d7faf28959cbf2256fb04ea641c4fd23ea69cbf3d7d105 AS livekit
FROM docker.io/library/caddy@sha256:fc9cbc100585871d18d4e451cca7021785c90a7006087427ae5ceb3e4efe6424 AS caddy
FROM ubuntu:24.04@sha256:9c7f200c07e3d4a03e7249d2c16bf66a51120fb876aa2242cf31451412543289 AS rootfs
ARG DEBIAN_FRONTEND=noninteractive
# No service is started, database initialized or machine identity generated here.
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod 755 /usr/sbin/policy-rc.d \
 && sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources \
 && apt-get update && apt-get install -y --no-install-recommends \
    systemd systemd-sysv dbus ca-certificates curl openssl python3 \
    postgresql-16 haproxy nftables iproute2 procps libstdc++6 libatomic1 \
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
COPY --chmod=0755 scripts/server-wsl-maintenance.py /usr/local/bin/castlink-server-maintenance
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
 && printf '{"schemaVersion":1,"version":"%s","commit":"%s","buildId":"%s-%s","lifecycle":{"schemaVersion":1,"runtimeContract":"castlink-wsl-pg16-v1","postgresMajor":16,"supportedSources":["server-wsl-v1.0.5-rc.1-085b087a2458","server-wsl-v1.0.5-rc.2-af3e309d0926","server-wsl-v1.0.5-rc.3-95ec46463c82","server-wsl-v1.0.6-rc.1-dad063393b53","server-wsl-v1.0.7-0d16de2e782c","server-wsl-v1.0.8-1afa39b54dd7","server-wsl-v1.0.9-35dbb73b5925","server-wsl-v1.0.10-890a903d51f9"]}}\n' \
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
# Prefer the nearby Ubuntu archive on hosted Azure builders. Keep the original
# signed source indexes available for the exact versions installed in rootfs.
RUN for suite in noble noble-updates noble-backports noble-security; do printf 'deb-src [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://azure.archive.ubuntu.com/ubuntu %s main restricted universe multiverse\n' "$suite"; done > /etc/apt/sources.list.d/00-castlink-factory.list \
 && apt-get -o Dir::Etc::sourcelist=/etc/apt/sources.list.d/00-castlink-factory.list -o Dir::Etc::sourceparts=- -o APT::Get::List-Cleanup=false -o Acquire::Retries=2 -o Acquire::https::Timeout=30 update \
 && python3 /usr/lib/castlink-server/collect-sources.py /opt/castlink-sources \
 && tar -czf /opt/CastLink-Server-WSL-Sources.tar.gz -C /opt/castlink-sources .
