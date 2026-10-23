# syntax=docker/dockerfile:1
FROM docker.io/library/haproxy@sha256:5d97434a423c2533cfeb42874d45cf6d69a840b60334582dfbfd5008e94c80be
ARG CASTLINK_SOURCE_COMMIT
LABEL ru.castlink.image.owner="castlink" \
      ru.castlink.image.ownership="castlink-build-v1" \
      ru.castlink.image.source="${CASTLINK_SOURCE_COMMIT}" \
      ru.castlink.image.stage="turntls-runtime"
USER root
RUN --mount=type=secret,id=proxy_ca,target=/run/proxy-ca,required=false \
    if [ -s /run/proxy-ca ]; then \
      cat /etc/ssl/cert.pem /run/proxy-ca > /tmp/build-ca.pem; \
      SSL_CERT_FILE=/tmp/build-ca.pem apk add --no-cache openssl; \
      rm /tmp/build-ca.pem; \
    else apk add --no-cache openssl; fi
COPY infrastructure/turn-tls/entrypoint.sh /usr/local/bin/castlink-turn-tls
RUN chmod 755 /usr/local/bin/castlink-turn-tls
ENTRYPOINT ["/usr/local/bin/castlink-turn-tls"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=3 CMD ["/usr/local/bin/castlink-turn-tls", "health"]
