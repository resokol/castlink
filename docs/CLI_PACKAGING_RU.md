# Внутренняя упаковка CastLink CLI

Упаковщик создаёт только development-архивы для `win32-x64`, `darwin-arm64` и `darwin-x64`. Подписанный пользовательский релиз, лицензия проекта и физическая Windows/macOS acceptance пока не подтверждены. Публичная публикация архивов этим инструментом не выполняется.

На машине разработчика нужны Node.js и Python 3. Windows developer build использует штатный Python launcher `py -3`, Unix — `python3`. Сначала скомпилируйте CLI, подготовьте проверенный server release manifest и скачайте соответствующий upstream архив Node.js 22.23.3. Упаковщик проверяет его байты по встроенному SHA256; криптографическая проверка подписи upstream SHASUMS этим этапом не выполняется.

```sh
pnpm --filter @castlink/cli build
node scripts/package-cli.mjs --development \
  --target darwin-arm64 \
  --runtime-archive /absolute/path/node-v22.23.3-darwin-arm64.tar.gz \
  --dist apps/cli/dist \
  --server-manifest /absolute/path/release.json \
  --output /absolute/path/new-output-directory
```

Для Windows используйте `--target win32-x64` и upstream `.zip`; для Intel Mac — `--target darwin-x64` и соответствующий `.tar.gz`. Выходной каталог должен быть новым: existing/partial output не перезаписывается. Ошибка после начала записи сохраняет частичный output для диагностики; выберите другой новый каталог после устранения причины.

Архив содержит versioned root, относительный `bin/castlink` или `bin/castlink.cmd`, bundled Node, полный upstream aggregate LICENSE, все compiled CLI JavaScript modules и ESM package.json, `server/release.json`, отдельный `cli-release.json`, notices, integrity bootstrap и `SHA256SUMS`. Рядом с архивом создаётся его `.sha256`. npm/Corepack, исходный checkout, credentials и installer state не включаются. Docker Desktop не поставляется. Server manifest в архиве не доказывает доступность image registry или успешную установку сервера.

После распаковки launcher работает вне repository cwd и не требует глобального Node/npm. Windows использует штатные certutil/findstr, macOS — `/usr/bin/shasum`; отсутствие этих средств приводит к отказу. Launcher проверяет Node и bootstrap до исполнения, затем bootstrap проверяет остальной payload до импорта CLI. Параметры запуска Node из окружения очищаются. Эта цепочка обнаруживает изменение байтов, но не аутентифицирует совместно подменённые launcher/root и не заменяет подпись релиза или доверенный OS toolchain.

Доказано в managed Linux: три настоящих upstream архива и их LICENSE/layout, отказ при повреждении runtime/bootstrap/payload/metadata, Spaces/Unicode/outside-cwd и argv/stdin/exit forwarding через Linux fixture. Windows launcher проверен статически; Mach-O/Windows runtimes в Linux не исполнялись. Пять focused tests прошли после исправления startup environment; физические target-platform, signing/notarization, clean setup, TLS и media остаются отдельными этапами.
