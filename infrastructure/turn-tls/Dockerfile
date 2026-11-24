# syntax=docker/dockerfile:1
FROM docker.io/library/haproxy@sha256:58706d9d772602f369bac3604be2303dce0ebc795d1178ac496eb1d0d2528a91
ARG CASTLINK_SOURCE_COMMIT
LABEL ru.castlink.image.owner="castlink" \
      ru.castlink.image.ownership="castlink-build-v1" \
      ru.castlink.image.source="${CASTLINK_SOURCE_COMMIT}" \
      ru.castlink.image.stage="turntls-runtime"
USER root
RUN --mount=type=secret,id=proxy_ca,target=/run/proxy-ca,required=false \
    set -eu; if [ -s /run/proxy-ca ]; then \
      cat /etc/ssl/cert.pem /run/proxy-ca > /tmp/build-ca.pem; \
      export SSL_CERT_FILE=/tmp/build-ca.pem; \
    fi; \
    apk add --no-cache openssl=3.5.9-r1; \
    rm -f /tmp/build-ca.pem
COPY infrastructure/turn-tls/entrypoint.sh /usr/local/bin/castlink-turn-tls
RUN chmod 755 /usr/local/bin/castlink-turn-tls
ENTRYPOINT ["/usr/local/bin/castlink-turn-tls"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=3 CMD ["/usr/local/bin/castlink-turn-tls", "health"]
