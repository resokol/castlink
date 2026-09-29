# CastLink 1.0: TURN / TLS fallback

## Цель

Дать WebRTC-подключению запасной маршрут, когда прямой ICE/UDP диапазон 61000-61100 или ICE/TCP 7881 блокируются корпоративной сетью.

Текущий VPS:
- public IPv4: 168.113.157.48;
- основной сайт: castlink.ru;
- Caddy занимает TCP/443;
- LiveKit работает в host network.

## DNS

Для TURN используется отдельное имя:

```text
turn.castlink.ru -> 168.113.157.48
```

Отдельное имя обязательно для нормального TURN/TLS и сертификата.

## Этап 1: безопасное расширение без переноса web/TLS

Embedded TURN LiveKit:
- TURN/UDP: UDP 443;
- TURN/TLS: TCP 5349;
- domain: turn.castlink.ru.

UDP/443 не конфликтует с Caddy TCP/443, но Caddy по умолчанию также занимает UDP/443 для HTTP/3. Поэтому на production HTTP/3 отключён для `:443` (`protocols h1 h2`), чтобы освободить UDP/443 под TURN. TCP/5349 не конфликтует с сайтом.

Этот этап существенно повышает проходимость, но сети, разрешающие только TCP/TLS 443, всё ещё требуют этап 2.

## Этап 2: полный corporate fallback на TCP/TLS 443

На single-IP VPS используется L4 SNI mux на HAProxy:

- HAProxy принимает публичный TCP/443;
- SNI `turn.castlink.ru` направляется в LiveKit TURN/TLS на `127.0.0.1:5349`;
- остальные TLS-подключения направляются в Caddy на внутренний `127.0.0.1:8443`;
- HAProxy передаёт Caddy PROXY protocol v2, поэтому исходный IP клиента не теряется;
- Caddy принимает PROXY protocol только от loopback и продолжает завершать TLS сам;
- UDP/443 остаётся у LiveKit TURN/UDP и не проходит через HAProxy.

HAProxy config: `infrastructure/haproxy/haproxy.cfg`.

Для Caddy HTTPS-сайты привязываются к `127.0.0.1`, а listener `:443` получает `proxy_protocol` wrapper перед `tls`. Публичный HTTP/80 остаётся у Caddy для redirect/ACME HTTP challenge. Для `turn.castlink.ru` TLS-ALPN challenge отключается, чтобы renewal сертификата TURN не конфликтовал с SNI route в LiveKit.

Это даёт fallback для сетей, где доступен только TCP/TLS 443, без переноса web TLS termination из Caddy.

## LiveKit

Шаблон находится в `infrastructure/livekit/turn.example.yaml`.

Сертификат TURN должен:
- быть выдан публичным CA;
- содержать `turn.castlink.ru`;
- быть доступен контейнеру LiveKit только на чтение;
- обновляться автоматически с контролируемым reload/restart LiveKit.

Не хранить private key в git.

## Firewall

Для этапа 1 должны быть доступны с интернета:
- UDP 443 — TURN/UDP;
- TCP 5349 — TURN/TLS;
- TCP 7881 — ICE/TCP;
- UDP 61000-61100 — direct ICE/UDP.

## Проверка

После включения:
1. DNS `turn.castlink.ru` разрешается в 168.113.157.48.
2. LiveKit слушает UDP/443 и TCP/5349.
3. TLS certificate на 5349 соответствует `turn.castlink.ru`.
4. Обычный прямой WebRTC остаётся рабочим.
5. В тестовой сети блокируется direct UDP range и проверяется relay candidate.
6. Отдельно тестируется сеть без UDP; для гарантированного TCP/443 нужен этап 2.

LiveKit сам выдаёт TURN credentials клиентам после signal connection; статические TURN username/password в frontend не добавлять.

## Статус production 29.09.2026

Этапы 1 и 2 установлены на VPS.

Проверено после cutover:
- `turn.castlink.ru` резолвится в `168.113.157.48`;
- HAProxy слушает public TCP/443;
- SNI `castlink.ru` проходит через HAProxy в Caddy на `127.0.0.1:8443`;
- SNI `turn.castlink.ru` проходит через HAProxy в LiveKit TURN/TLS на `127.0.0.1:5349`;
- внешний TLS preflight на `turn.castlink.ru:443` проходит с публичным сертификатом CN=`turn.castlink.ru`;
- внешний TLS preflight на `turn.castlink.ru:5349` также проходит;
- `https://castlink.ru` после L4 cutover отвечает HTTP 200;
- LiveKit слушает UDP/443 для TURN/UDP и TCP/5349 для TURN/TLS;
- relay range: UDP 30000-30999;
- штатный LiveKit TCP/7881 и direct UDP 61000-61100 сохранены;
- `node scripts/turn-stage2-preflight.mjs --expected-ip 168.113.157.48` проходит.

Первая попытка stage 2 была автоматически откатана, когда HAProxy не смог bind на конкретный host IP из host-network контейнера. Рабочая конфигурация использует `bind ":443"` с `NET_BIND_SERVICE`; rollback сработал корректно.

Ограничение: реальный WebRTC relay-проход с принудительно заблокированным direct UDP ещё нужно подтвердить браузером или мобильной сетью. TLS transport path готов, но это отдельная end-to-end проверка acceptance criteria.

## Production safety

Перед изменением LiveKit:
- убедиться, что нет активного эфира;
- сохранить `livekit.yaml`, compose и Caddyfile;
- сначала валидировать и reload Caddy после отключения h3/добавления TURN hostname;
- иметь простой rollback к предыдущим `livekit.yaml`, compose и Caddyfile.
