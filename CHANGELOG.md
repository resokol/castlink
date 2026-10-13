# Changelog

Все заметные изменения CastLink фиксируются здесь. Формат версий следует SemVer.

## [Unreleased]

## [1.0.0-rc.1] - 2026-09-30

Release candidate для финальной проверки CastLink 1.0.

### Основные изменения
- multi-tenant модель Account → Organization → Studio → Room;
- node scheduler и signed heartbeat;
- удалённые media nodes без прямого доступа к central PostgreSQL;
- tenant-aware server transfer/failover с переносом Studio assignment;
- PostgreSQL room storage, migration/import и backup/restore;
- TURN/TLS path через HAProxy/LiveKit;
- production install/update/rollback foundation;
- observability, health, diagnostics и structured logging;
- безопасное разбиение критического Studio monolith перед RC.

### Статус RC
- кодовый CI зелёный на `1.0-integration`;
- production/VPS ещё не переведён на этот RC;
- обязательны реальные acceptance-проверки перед `1.0.0`: production deploy/rollback, browser/device flows, TURN relay, VPS↔Home failover и PostgreSQL restore;
- soak/stress (#5) выполняется последним.

### Release foundation
- Добавлена единая схема product version + build id.
- Подготовлен CI для TypeScript, стабильных тестов и production build.
- Добавлена release policy для ветки CastLink 1.0.

## [0.9.29] - 2026-09-28

Последняя подтверждённая версия до начала подготовки CastLink 1.0.

Основные возможности текущей линии 0.9:
- гостевые комнаты и роли studio/admin/moderator;
- Studio Return и отдельные output-потоки;
- выбор и удалённое управление устройствами;
- WebRTC статистика и recovery;
- screen sharing;
- перенос комнаты между серверами.
