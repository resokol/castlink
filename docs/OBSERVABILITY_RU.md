# CastLink 1.0: observability и health checks

## Цель

Оператор должен быстро отличать проблему web-приложения от LiveKit/TURN и видеть базовую информацию о сборке без раскрытия секретов.

## Health endpoint

Добавлен:

```text
GET /api/health
```

Ответ содержит:
- общий `status`: `ok` или `degraded`;
- `productVersion`;
- `buildId`;
- выбранный `storageBackend`;
- uptime процесса;
- отдельные проверки `web`, `livekit`, `turnTls`;
- latency проверки LiveKit TCP и TURN/TLS.

Endpoint не возвращает:
- `LIVEKIT_API_SECRET`;
- session/data-encryption secrets;
- пароли БД;
- TURN credentials.

## Переменные

```text
CASTLINK_HEALTH_TIMEOUT_MS=1500
CASTLINK_TURN_HEALTH_HOST=turn.castlink.ru
CASTLINK_TURN_TLS_PORT=443
```

Для LiveKit используется `LIVEKIT_SERVER_URL`, по умолчанию `http://127.0.0.1:7880`.

## Интерпретация

- `web.ok=true`, `livekit.ok=false` — web отвечает, но backend LiveKit недоступен по TCP.
- `turnTls.ok=false` — TURN/TLS endpoint недоступен или TLS не проходит проверку.
- HTTP 200 — все включённые проверки прошли.
- HTTP 503 — приложение отвечает, но хотя бы один backend check degraded.

## Что ещё остаётся по Issue #6

Эта реализация закрывает только health/build часть задачи.

Ещё нужно:
- structured server logs;
- correlation id для request/room/session;
- log rotation для всех production сервисов;
- disk limits для runtime/stats;
- operator diagnostics page;
- support bundle с обезличенной диагностикой.

До реализации support bundle нельзя считать Issue #6 полностью закрытым.
