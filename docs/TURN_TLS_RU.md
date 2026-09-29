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

LiveKit рекомендует TURN/TLS на 443, если перед ним нет L4 load balancer. На текущем single-IP VPS TCP/443 уже занят Caddy.

Для полного fallback нужен один из вариантов:
1. L4 SNI proxy перед Caddy и LiveKit;
2. второй публичный IPv4 для TURN;
3. внешний L4 load balancer.

Предпочтение для CastLink: L4 SNI proxy или отдельный IP. Нельзя просто занять TCP/443 LiveKit — это отключит сайт.

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

Этап 1 установлен на VPS:
- `turn.castlink.ru` резолвится в VPS;
- Caddy получил публичный сертификат для TURN hostname;
- HTTP/3 на Caddy `:443` отключён, UDP/443 освобождён;
- embedded TURN LiveKit слушает UDP/443 и TLS/TCP 5349;
- relay range: UDP 30000-30999;
- внешний TLS preflight с Windows прошёл, сертификат `turn.castlink.ru` валиден;
- штатный LiveKit TCP/7881 и direct UDP 61000-61100 сохранены.

Ограничение: реальный WebRTC relay-проход с принудительно заблокированным direct UDP ещё нужно подтвердить браузером/мобильной сетью. Этап 2 (TURN/TLS TCP/443) не установлен, потому что TCP/443 занимает Caddy и для безопасного разделения нужен L4 SNI proxy, второй IP или внешний L4 load balancer.

## Production safety

Перед изменением LiveKit:
- убедиться, что нет активного эфира;
- сохранить `livekit.yaml`, compose и Caddyfile;
- сначала валидировать и reload Caddy после отключения h3/добавления TURN hostname;
- иметь простой rollback к предыдущим `livekit.yaml`, compose и Caddyfile.
