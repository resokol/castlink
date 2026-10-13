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

## Operator diagnostics

Добавлена страница:

```text
/diagnostics
```

Она читает только `/api/health` и показывает:
- общий статус;
- версию/build;
- storage backend;
- uptime;
- отдельные web/LiveKit/TURN проверки и latency.

## Support bundle

Команда:

```bash
CASTLINK_BASE_URL=https://castlink.example pnpm support:bundle
```

Создаёт JSON-файл mode 0600 с:
- `/api/version`;
- `/api/health`;
- Node/platform/arch;
- количеством CPU;
- общим/свободным объёмом RAM.

Скрипт намеренно не читает environment variables и не добавляет hostname, токены, DB URL или application secrets.

## Structured logs и correlation ID

Добавлен server-only JSON logger. Для auth, room mutation и LiveKit token issuance:
- каждому запросу назначается безопасный `requestId`;
- входящий `x-request-id` принимается только в ограниченном безопасном формате;
- `x-request-id` возвращается в ответе;
- события пишутся одной JSON-строкой с timestamp, level, event и duration;
- поля с именами `secret/token/password/authorization/cookie/cipher/invite/access` автоматически заменяются на `[redacted]`.

Логирование не читает environment variables с секретами и не пишет JWT/token payload.

## Retention и ротация

WebRTC statistics уже ограничены в приложении:
- retention: 26 часов;
- default cap: 512 MiB;
- override: `STUDIOLINK_STATS_MAX_BYTES`, минимум 64 MiB;
- cleanup запускается не чаще одного раза в час при записи и удаляет старейшие hourly JSONL.

`/api/health` показывает фактически выбранные `statsRetentionHours` и `statsMaxBytes`.

Для Docker production сервисов рекомендуется одинаковая ротация:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

Это ограничивает новые container logs примерно 30 MiB на контейнер. Применение этой настройки к фактическому VPS compose остаётся отдельной production-операцией и не выполняется из GitHub-only работы.

## Что ещё остаётся по Issue #6

Эта реализация закрывает health/build, minimal diagnostics page, sanitized support bundle и базовый structured logging/correlation ID.

Ещё нужно:
- расширить correlation ID на остальные критические control-plane endpoints при необходимости;
- log rotation для всех production сервисов;
- disk limits для runtime/stats;
- operator diagnostics page;
- support bundle с обезличенной диагностикой.

До реализации support bundle нельзя считать Issue #6 полностью закрытым.
