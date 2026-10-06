# syntax=docker/dockerfile:1
# Build context is this directory plus the verified, untracked node binary and
# its original LICENSE. No host Chromium, /usr, HOME or NSS mount is used.
FROM debian@sha256:a99cfc517144bc59b1978475ec53b46ecabec7e43635402ee5b77cc54cd1b20a
RUN --mount=type=secret,id=proxy_ca,required=true,mode=0444 \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca update && \
    apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca install -y --no-install-recommends \
      chromium=154.0.8037.92-1~deb13u1 chromium-common=154.0.8037.92-1~deb13u1 libnss3-tools=2:3.110-1+deb13u4 ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY node /opt/castlink/node
COPY node-LICENSE /usr/share/doc/castlink-node/LICENSE
RUN echo 'fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48  /opt/castlink/node' | sha256sum -c - && \
    test "$(/opt/castlink/node --version)" = v22.23.3 && \
    mkdir -p /root && chmod 700 /root && \
    dpkg-query -W > /usr/share/doc/castlink-node/debian-package-versions.txt
COPY runtime.mjs runtime-contract.json /opt/castlink/
LABEL castlink.diagnostic-browser.contract="castlink-diagnostic-browser-runtime-v1"
WORKDIR /root
ENTRYPOINT ["/opt/castlink/node", "/opt/castlink/runtime.mjs"]

CMD ["--idle"]
