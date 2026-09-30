# CastLink 1.0: persistent storage, backup и restore

## Что считается постоянными данными

Production обязан задавать \`STUDIOLINK_DATA_DIR\`. Рекомендуемая схема Docker:

\`\`\`text
STUDIOLINK_DATA_DIR=/data
/data/installation.json
/data/runtime/studiolink-rooms.json
/data/runtime/studiolink-moderator-access.json
/data/runtime/studiolink-studio-control.json
/data/stats/...
\`\`\`

Каталог \`/data\` должен быть bind mount/volume, который переживает recreate контейнера.

\`STUDIOLINK_INSTALLATION_ID\` — UUID конкретной установки. Если он задан при первом запуске, он записывается в \`installation.json\`; при несовпадении приложение прекращает запуск. Это защищает от случайного подключения data directory другого сервера.

Индивидуальные переменные \`STUDIOLINK_ROOMS_FILE\`, \`STUDIOLINK_MODERATOR_ACCESS_FILE\`, \`STUDIOLINK_STUDIO_CONTROL_FILE\` и \`STUDIOLINK_STATS_DIR\` остаются override для тестов/миграции.

## Что можно потерять при restart

Постоянные:
- комнаты, пароли и версии public links;
- moderator access/revoke state;
- настройки Studio Control и сохранённые параметры;
- история WebRTC statistics в пределах retention.

Эфемерные:
- server-transfer tickets/nonces и незавершённый перенос;
- временные guest move commands;
- текущие LiveKit connections.

Эфемерные данные намеренно могут оставаться в \`/tmp\`: после рестарта незавершённую операцию нужно начать заново.

## Формат и повреждение данных

Новые durable JSON-файлы записываются с \`schemaVersion: 1\`. Legacy 0.9 формат читается и мигрирует при следующей записи.

Запись выполняется через временный файл и atomic rename, mode 0600. При битом JSON или неизвестной schema startup validation завершается ошибкой; приложение не подменяет повреждённый файл пустым состоянием/demo-room.

## Backup

Перед backup лучше не менять комнаты/права. Для полностью согласованного production snapshot остановите только web container; LiveKit/Caddy трогать не требуется.

\`\`\`bash
node scripts/storage-backup.mjs \
  --data-dir /opt/studiolink/data \
  --output /opt/studiolink/backups/storage-YYYYMMDD-HHMM \
  --config /opt/studiolink/docker-compose.yml \
  --config /opt/studiolink/Caddyfile
\`\`\`

Скрипт проверяет \`installation.json\`, JSON runtime-state, копирует data directory, считает SHA-256 каждого файла и создаёт \`manifest.json\`.

Secrets (\`web.env\`, \`transfer.env\`, LiveKit secret) не добавляются автоматически. Их резервная копия должна храниться отдельно с ограниченным доступом.

## Restore

1. Сделать свежий backup текущего состояния.
2. Остановить web container.
3. Выполнить:

\`\`\`bash
node scripts/storage-restore.mjs \
  --backup /opt/studiolink/backups/storage-YYYYMMDD-HHMM \
  --data-dir /opt/studiolink/data \
  --confirm-stopped \
  --force
\`\`\`

Restore сначала проверяет размеры и SHA-256 всех файлов. Существующий data directory переименовывается в \`.pre-restore-...\`, а восстановленный каталог ставится на его место.

Если backup принадлежит другому \`installationId\`, restore прекращается. Для осознанной полной замены установки требуется дополнительный флаг \`--replace-installation\`.

Конфиги из backup восстанавливаются только при явном \`--config-dir <dir>\`.

4. Запустить web container.
5. Проверить \`/api/version\`, комнаты, guest access, moderator access, Studio Return и статистику.

## Production migration с 0.9

Текущий VPS уже хранит \`/opt/studiolink/data\` вне контейнера. Перед выпуском этой ветки:

1. сохранить проверенный backup;
2. добавить в web environment:
   - \`STUDIOLINK_DATA_DIR=/data\`;
   - уникальный \`STUDIOLINK_INSTALLATION_ID=<uuid>\`;
3. оставить bind mount \`./data:/data\`;
4. старый mount \`./data/runtime:/tmp\` можно оставить на первый migration запуск для legacy transfer/temp state, но durable stores после миграции используют \`/data/runtime\`;
5. после проверки убрать зависимость durable state от \`/tmp\`.

Не копируйте один и тот же data directory одновременно между двумя активными инсталляциями.


## PostgreSQL backup / restore

После перехода комнат на `CASTLINK_STORAGE_BACKEND=postgres` файлового backup каталога `/data` недостаточно: источник истины комнат находится в PostgreSQL.

Создать consistent custom-format dump:

```bash
cd /opt/studiolink
bash scripts/postgres-backup.sh /opt/studiolink/backups/postgres-YYYYMMDD-HHMM.dump
```

Скрипт:
- использует PostgreSQL service из production compose;
- запускает `pg_dump --format=custom --no-owner --no-acl`;
- проверяет dump через `pg_restore --list`;
- сохраняет файл с mode 0600;
- создаёт соседний SHA-256 файл `.sha256`;
- не печатает пароль БД.

Перед restore обязательно остановить web, чтобы во время замены БД не было конкурентных записей:

```bash
docker compose -f /opt/studiolink/infrastructure/production/docker-compose.yml stop web

bash scripts/postgres-restore.sh   /opt/studiolink/backups/postgres-YYYYMMDD-HHMM.dump   --confirm-replace
```

Restore:
- проверяет SHA-256, если checksum-файл присутствует;
- отказывается работать, пока `studiolink-web` запущен;
- предварительно проверяет dump через `pg_restore --list`;
- выполняет guarded `pg_restore --clean --if-exists --create`;
- не запускает web автоматически.

После restore:

```bash
docker compose -f /opt/studiolink/infrastructure/production/docker-compose.yml up -d web
curl -fsS http://127.0.0.1:3000/api/version
```

Затем проверить `/api/health`, список Studio, комнаты одинаковых имён в разных Studio и owner/guest access.

`production-update.sh` теперь автоматически добавляет `postgres.dump` и checksum в pre-update backup, если PostgreSQL service уже запущен. До первого DB cutover отсутствие работающего PostgreSQL допускается и явно отмечается как skipped.
