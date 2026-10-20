**Русский** · [English](docs/en/LINUX_INSTALL.md) · [简体中文](docs/zh-CN/LINUX_INSTALL.md)

## 20.10.2026 · 1472cd052d7e · Исправления кастера и окон управления

- Нативные окна Windows следуют выбранной теме CastLink; выбор источника экрана оформлен для светлой и тёмной тем.
- Галерея кастера использует доступную ширину, чат стал на 15% уже, кнопки центрированы. В режиме «только студия» сохраняется локальный предпросмотр камеры. Полноэкранная плитка скрывает элементы управления при бездействии.
- Персонал может удалить самостоятельный инвайт, пока он не привязан к слоту; связанные постоянные выходы сохраняются.
- Для отсутствующего профиля микрофона используется оригинальный звук без шумоподавления и эхоподавления. Явно сохранённый речевой профиль сохраняется.
- Crop мультивью маскирует края без сдвига, изменения масштаба и пропорций исходника.
- В браузерной плавающей панели появилась кнопка «Компактный размер». Нажмите её, если браузер восстановил увеличенное окно; общий размер учитывает независимую кнопку STOP. Браузер по-прежнему может выбирать начальный размер самостоятельно.

Обновите сервер и Windows-клиент. Полностью закройте старый клиент и запустите новый EXE; самообновления EXE нет. Страницы обновляйте вручную вне эфира. Перед обновлением своего сервера сделайте резервную копию и завершите подключения. EXE без цифровой подписи. Физические PowerPoint, устройства и полный эфир отдельно не проверены.

Изолированный конвертер PPTX, прежние лимиты и серверные права сохранены. И прочие мелкие изменения.

# CastLink: установка на Linux без Windows и графического мастера

## Новый самостоятельный Linux helper

Пакеты этого общего выпуска автоматически запускают изолированный конвертер PPTX вместе с сервером; отдельно устанавливать PowerPoint, LibreOffice или Python для конвертации не нужно. Локальный PDF открывается прежним просмотрщиком. Для самостоятельно собранной или старой конфигурации сервера одного обновления страницы недостаточно: требуется настроенный изолированный конвертер. [Показ PDF/PPTX и управление](PRESENTATIONS.md) · [История изменений](CHANGELOG.md)

Для нового сервера используйте [easy-setup-1472cd052d7e](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1472cd052d7e) и [INSTALL.md](INSTALL.md). Нужны Linux amd64, Python 3.8+, Docker Engine и Compose v2. Это консольный helper без Windows; графического установщика Linux нет.

Скачайте архив и контрольные суммы **из одного точного выпуска** в отдельную папку. Не запускайте эти команды в каталоге работающей установки:

```bash
set -euo pipefail
RELEASE_TAG=easy-setup-1472cd052d7e
RELEASE_BASE="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
mkdir -p "$HOME/castlink-package-$RELEASE_TAG"
cd "$HOME/castlink-package-$RELEASE_TAG"
curl -fL "$RELEASE_BASE/CastLink-Linux.tar.gz" -o CastLink-Linux.tar.gz
curl -fL "$RELEASE_BASE/SHA256SUMS" -o SHA256SUMS
printf '%s\n' '3d25045ffa4ea8478535742f268c9be6f988b209507e7fd90a73cb7ed4ca341e  CastLink-Linux.tar.gz' | sha256sum --check -
sha256sum --check --ignore-missing SHA256SUMS
mkdir bundle
tar -xzf CastLink-Linux.tar.gz -C bundle
cd bundle
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --lang ru
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang ru
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang ru
```

Проверка SHA-256 должна завершиться успешно до распаковки и запуска. `init` предлагает быстрый/расширенный режим и сохраняет настройки; `start` загружает встроенные образы, запускает службы и подготавливает БД. Если выбранный каталог требует root, выполняйте команды от администратора; Docker должен быть доступен тому же пользователю. Для EN/简体中文 замените `--lang ru` на `--lang en` / `--lang zh-CN`.

Расширенные HTTP/HTTPS/внешний прокси, JSON-конфигурация, доверенные прокси, сертификаты и медиапорты описаны в INSTALL. HTTP по LAN/публичному IP не разрешает браузерную камеру/микрофон; для участников нужен доверенный HTTPS. Настройки сайта не заменяют TCP 7881, UDP 7882, TURN UDP 3478 и UDP 30000–30031 либо выбранные расширенные порты.

`/opt/castlink-manual` — постоянный каталог конфигурации и приватного состояния: `compose.json`, `Caddyfile`, `livekit.json`, env и секреты. Сохраните его после распаковки/обновления пакета и не публикуйте содержимое. Helper не подхватывает Windows-мастер или legacy-установку и не меняет их данные.

Перед обновлением сохраните конфигурацию и резервную копию вне эфира:

```bash
python3 scripts/linux-compose-setup.py backup --state-dir /opt/castlink-manual --lang ru
```

Распакуйте **новый проверенный** выпуск в другую папку, перейдите в неё и выполните:

```bash
python3 scripts/linux-compose-setup.py update --state-dir /opt/castlink-manual --lang ru
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang ru
```

`update` останавливает службы на время согласованной копии PostgreSQL/web-data и конфигурации, затем запускает новый выпуск; UUID, сеть, секреты и имена томов сохраняются. Автоматического отката БД/данных нет: старый код может быть несовместим с новой схемой. При ошибке сохраните журналы и копию, повторный `start` используйте осознанно для выбранного выпуска. Не применяйте `docker compose down -v`: он удаляет данные.

Проверьте адрес и `/api/version`, затем видео, звук, обратный поток и внешний доступ с другого устройства. Успешный внутренний HTTP в proxy-режиме не доказывает внешний HTTPS или работу TURN через вашу сеть.

## Legacy: закреплённая процедура 8b02

Для функций 1.0.0-rc.3 / 776AF9, включая постоянные слоты и автоматическую проверку устройств, нужен обновлённый сервер комнаты. Подробности — в [истории изменений](CHANGELOG.md); команды ниже по-прежнему устанавливают закреплённый прежний выпуск.

Раздел ниже сохранён для прежней процедуры `easy-setup-8b02e2d4dc3c`. Его теги, контрольные суммы и команды относятся только к ней: не заменяйте их на `latest` или новый тег. Новый `linux-compose-setup.py` не принимает эту установку; перенос требует отдельного плана, резервной копии и проверки совместимости. Команды ниже не устанавливают текущий выпуск.

Инструкция для опубликованного тестового выпуска [`easy-setup-8b02e2d4dc3c`](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-8b02e2d4dc3c). Сервер разворачивается из готовых образов; Git, Node.js, сборка приложения и Windows не нужны. **Docker Engine и Docker Compose нужны на VPS.** На устройствах кастеров нужен только браузер.

Ниже используется служебный `server-provision-vps.py`, который входит в готовый серверный образ. Это не интерактивный установщик: он принимает один JSON через стандартный ввод. Отдельного исполняемого файла `castlink install` и флагов `--domain` у этого помощника нет. Linux-архив содержит образы и скрипт подготовки Docker; сам по себе запуск скрипта подготовки CastLink не устанавливает.

### 1. Подготовьте отдельный VPS

- Ubuntu **22.04 или 24.04**, архитектура **amd64/x86_64**, публичный постоянный IPv4, root-доступ по SSH.
- Для первого теста рекомендуются **2 vCPU, 4 ГБ RAM и от 20 ГБ свободного диска**. Это запас для запуска, образов и резервных копий, а не обещание конкретной вместимости. Отдельный профиль с 2 ГБ RAM и swap проверялся; это не гарантированный минимум под эфирной нагрузкой. Число кастеров, качество видео и канал проверяйте своей нагрузкой.
- Свободные порты из таблицы ниже, разрешённые в панели провайдера и firewall сервера. Не занимайте их другим веб-сервером.
- Исходящий HTTPS к GitHub и серверам загрузки его файлов, репозиториям Ubuntu/Docker и ACME-службе Let's Encrypt. Системное время должно быть правильным.

| Назначение | Входящие порты |
| --- | --- |
| SSH для управления | TCP 22 либо ваш настроенный SSH-порт |
| HTTPS и получение сертификата | TCP 443 и TCP 80 |
| Медиасоединения LiveKit | TCP 7881, UDP 7882 |
| TURN/UDP | UDP 3478 и UDP 30000–30031 |

Это порты именно конфигурации Python-помощника этого выпуска. TCP 3000, TCP 5432 и TCP 7880 наружу не публикуются. TURN через TLS/TCP 443 этим способом не настраивается; в сетях, запрещающих UDP, медиасвязь требует отдельной проверки. Правила Docker и firewall провайдера также влияют на доступность портов.

Все следующие команды выполняйте **на VPS**, в одной root-сессии Bash. Здесь `203.0.113.10` — пример: замените его своим публичным IPv4. При первом SSH-подключении сверьте отпечаток ключа сервера с данными провайдера.

```bash
ssh root@203.0.113.10
```

Начните с проверки, которая откажется продолжать при обнаружении каталога прежней установки, в том числе остановленной. Для существующего сервера переходите к разделу обновления после проверки его конфигурации; не запускайте новую установку поверх данных.

```bash
set -euo pipefail
umask 077
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
test "$(id -u)" = 0
. /etc/os-release
test "$ID" = ubuntu
case "$VERSION_ID" in 22.04|24.04) ;; *) exit 1 ;; esac
test "$(uname -m)" = x86_64
if compgen -G '/opt/castlink-easy-*' >/dev/null; then
  echo 'Обнаружена прежняя установка. Остановитесь и проверьте её данные.' >&2
  exit 1
fi
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3
WORK_DIR=$(mktemp -d /root/castlink-install.XXXXXXXX)
cd "$WORK_DIR"
```

Сохраните путь, который покажет `pwd`: в этой папке останутся проверенный пакет, помощник и запрос установки.

```bash
pwd
```

### 2. Скачайте один фиксированный выпуск и проверьте SHA-256

```bash
RELEASE_TAG=easy-setup-8b02e2d4dc3c
RELEASE_BASE="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
for FILE in CastLink-Linux.tar.gz CastLink-Provisioning.json SHA256SUMS; do
  curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --retry 3 "$RELEASE_BASE/$FILE" -o "$FILE"
done
sha256sum --check <<'SUMS'
95e39918de48685ee5c86f434f53e5f5be54d2d9f21923e659189a7b5438d6a3  CastLink-Linux.tar.gz
d544a92d48772a3267539f2161a509fb0cc57ec1136dec7fefd85562ba38088c  CastLink-Provisioning.json
1c8cc067ed5165f691278f3a4be5250017569a5e8dc5a54db7f7f56c172a0d88  SHA256SUMS
SUMS
sha256sum --check --ignore-missing SHA256SUMS
mkdir bundle
tar -xzf CastLink-Linux.tar.gz -C bundle
```

Продолжайте только если проверки завершились без ошибок и показали `OK`. Приведённые суммы относятся только к указанному выпуску; не применяйте их к другому тегу. Проверка SHA-256 обнаруживает повреждение или подмену относительно ожидаемой суммы; файл сумм не является отдельной цифровой подписью.

Проверьте версию и внутренний архив образов:

```bash
python3 - <<'PY'
import hashlib, json
from pathlib import Path
r = json.loads(Path('bundle/payload/release.json').read_text())
p = json.loads(Path('CastLink-Provisioning.json').read_text())
assert r['commit'] == p['commit'] == '8b02e2d4dc3c286f2a5b6ace5859fbb645bae677'
assert r['distributionRepository'] == 'resokol/castlink-releases'
digest = hashlib.sha256()
with Path('bundle/payload/images.tar.gz').open('rb') as f:
    for block in iter(lambda: f.read(1024 * 1024), b''):
        digest.update(block)
assert digest.hexdigest() == r['imageArchiveSha256']
print('Образы проверены:', r['version'], r['commit'][:12])
PY
```

### 3. Подготовьте Docker и извлеките служебный помощник

Команда ниже запускает из проверенного пакета только подготовку Linux-среды. Она устанавливает недостающий Docker Engine/Compose, запускает Docker, если он остановлен, и готовит каталог `/opt/castlink`. Требуется Compose **не ниже 2.23.1**. Это не запускает Windows-мастер и ещё не разворачивает приложение.

```bash
bash bundle/scripts/ubuntu-easy-setup-bootstrap.sh install
docker --host unix:///var/run/docker.sock info --format '{{.OSType}}'
docker compose version
docker --host unix:///var/run/docker.sock load --input bundle/payload/images.tar.gz
WEB_IMAGE=$(python3 -c 'import json; print(json.load(open("bundle/payload/release.json"))["images"]["web"])')
TEMP_CONTAINER=$(docker --host unix:///var/run/docker.sock create \
  --network none --entrypoint /bin/true "$WEB_IMAGE")
docker --host unix:///var/run/docker.sock cp \
  "$TEMP_CONTAINER:/app/scripts/server-provision-vps.py" ./server-provision-vps.py
docker --host unix:///var/run/docker.sock rm "$TEMP_CONTAINER"
chmod 600 server-provision-vps.py
```

Временный контейнер не запускается: он нужен только для копирования служебного файла из опубликованного образа. Приложение из исходников не собирается. Остальные контейнеры и тома эти команды не удаляют.

### 4. Установите CastLink по публичному IPv4

Замените IP в следующем блоке. В поле `host` нужен **IPv4**, без `https://`, порта и пути. Домен `example.org` здесь не подставляйте: этот помощник строит медиаконфигурацию непосредственно из IPv4 и не имеет отдельного параметра домена.

```bash
python3 - <<'PY'
import hashlib, ipaddress, json
from pathlib import Path
host = '203.0.113.10'  # Замените своим публичным IPv4.
ipaddress.IPv4Address(host)
r = json.loads(Path('bundle/payload/release.json').read_text())
digest = hashlib.sha256()
with Path('CastLink-Linux.tar.gz').open('rb') as f:
    for block in iter(lambda: f.read(1024 * 1024), b''):
        digest.update(block)
request = {
    'action': 'deploy', 'host': host,
    'releaseUrl': 'https://github.com/resokol/castlink-releases/releases/download/easy-setup-8b02e2d4dc3c/CastLink-Linux.tar.gz',
    'releaseSha256': digest.hexdigest(),
    'releaseCommit': r['commit'], 'releaseCommitPrefix': r['commit'][:12],
}
Path('install-request.json').write_text(json.dumps(request))
PY
python3 server-provision-vps.py < install-request.json | tee install-events.jsonl
```

Помощник самостоятельно ещё раз скачает и проверит Linux-архив, загрузит образы, создаст случайные секреты и отдельную установку, запустит службы, подготовит БД и завершит первичную настройку. Эта дополнительная загрузка ожидаема. Строки JSON показывают этапы; успешный конец содержит объект `result` с `installationId`. Ошибка или ненулевой код выхода означают, что установку нужно проверить.

Сохраните путь установки в переменную и небольшой приватный файл, чтобы использовать его после нового входа по SSH:

```bash
INSTALL_DIR=$(python3 - <<'PY'
import json, uuid
from pathlib import Path
results = [v['result'] for line in Path('install-events.jsonl').read_text().splitlines()
           if isinstance((v := json.loads(line)).get('result'), dict)]
assert len(results) == 1
iid = uuid.UUID(results[0]['installationId'])
print('/opt/castlink-easy-' + iid.hex)
PY
)
printf '%s\n' "$INSTALL_DIR" > installation-path.txt
printf 'Каталог установки: %s\n' "$INSTALL_DIR"
```

Не публикуйте содержимое `web.env`, `postgres.env`, `.castlink-install.json` и резервные копии: там находятся секреты и данные установки.

### 5. Проверьте HTTPS и медиасвязь

Внутри этой установки работают четыре службы: `web`, `postgres`, `livekit`, `caddy`. Пятый образ TURN TLS может присутствовать в пакете, но этот способ его не запускает. Docker применяет политику `unless-stopped`.

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" ps --all
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" logs --tail 100 caddy
curl --fail --show-error https://203.0.113.10/api/version
```

Здесь и далее заменяйте пример IP своим адресом. Ожидаемый `buildId` — `1.0.0-rc.2-8b02e2d4dc3c`. Последнюю команду также выполните с другого компьютера вне сети VPS. Не добавляйте `-k`: нужна проверка доверенного сертификата.

Caddy настроен запрашивать и обновлять публичный сертификат Let's Encrypt для IP, используя ACME-профиль `shortlived`. Домен для этого маршрута не обязателен. Получение сертификата зависит от внешней доступности VPS и ACME-службы. Завершение Python-помощника подтверждает внутреннюю готовность приложения, **но само по себе не подтверждает внешний HTTPS или передачу медиа**. Если сертификат ещё не получен, проверьте журнал Caddy, доступность TCP 80/443, время и ограничения выдачи сертификатов; не отключайте проверку TLS.

Откройте `https://203.0.113.10/` в актуальном браузере. Создайте тестовую комнату, проверьте разрешения камеры/микрофона, подключение кастера с другой сети и просмотр студийного эфира. Проверяйте звук в наушниках. Успешный HTTP-ответ не заменяет тест видео и звука.

### 6. Статус, журналы, остановка и запуск

После нового SSH-входа вернитесь в сохранённую рабочую папку и восстановите переменную:

```bash
INSTALL_DIR=$(cat installation-path.txt)
test -f "$INSTALL_DIR/compose.json"
```

Статус и последние сообщения:

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" ps --all
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" logs --tail 100
docker --host unix:///var/run/docker.sock stats --no-stream
df -h /opt /var/lib/docker
```

Остановка и последующий запуск только этой установки:

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" stop
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" up -d --pull never --no-build
```

Выполняйте эти две команды по отдельности в нужный момент. Остановка прерывает эфир, но сохраняет данные. После ручного `stop` политика `unless-stopped` не обязана запускать службы при перезагрузке: используйте команду запуска выше.

Конфигурация находится в `$INSTALL_DIR`: `compose.json`, `web.env`, `postgres.env`, `livekit.json`, `Caddyfile`, `.castlink-install.json`. Постоянные данные находятся в Docker volumes этой установки: `postgres-data`, `web-data`, `caddy-data`, `caddy-config`; имена в Docker имеют префикс проекта. В них сохраняются БД, данные приложения и сертификаты. Сохраните и конфигурацию с секретами, и согласованные резервные копии данных. Простое копирование работающего PostgreSQL-тома не является согласованным бэкапом.

Не выполняйте `docker compose down -v`, общий `docker system prune --volumes` или удаление каталога установки для перезапуска/обновления. Не переносите один только `compose.json`: он ссылается на остальные файлы и данные.

### 7. Обновление существующей установки

Описанная ниже команда обновляет только web. Она не применяет новую схему портов Easy Setup и не пересоздаёт LiveKit. Для перехода с широких UDP-диапазонов используйте новый установщик и сначала разрешите UDP 7882 во внешних сетевых экранах и на роутере.

Повторный `deploy` не является обновлением. Для установки этого формата помощник поддерживает отдельный JSON с `action: update`. Он меняет только образ `web`, сохраняя UUID, профили, настройки, инфраструктурные контейнеры и тома. Это не механизм обновления Docker, PostgreSQL, LiveKit или Caddy.

Запланируйте окно обслуживания и завершите все сессии: помощник отказывается обновлять сервер с участниками или при невозможности проверить их отсутствие. Перед заменой он проверяет свободное место и совместимость SQL, сохраняет конфигурацию, PostgreSQL и `web-data` в `$INSTALL_DIR/backups/`, закрывает запись на время работ и проверяет HTTPS. При ошибке до открытия записи предусмотрен откат; при неудачном откате резерв остаётся для восстановления. Отказ из-за миграций требует отдельной инструкции соответствующего выпуска.

Следующий пример выбирает тот же выпуск и на установленном по этой инструкции сервере должен вернуть `outcome: current`. Для реального обновления замените `UPDATE_TAG` на **конкретный опубликованный тег** и сначала прочитайте его примечания и требования. Не смешивайте файлы разных выпусков. Выполняйте из сохранённой рабочей папки с установленным `INSTALL_DIR`.

```bash
UPDATE_TAG=easy-setup-8b02e2d4dc3c
UPDATE_BASE="https://github.com/resokol/castlink-releases/releases/download/$UPDATE_TAG"
UPDATE_DIR=$(mktemp -d "$PWD/update.XXXXXXXX")
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  "$UPDATE_BASE/SHA256SUMS" -o "$UPDATE_DIR/SHA256SUMS"
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  "$UPDATE_BASE/CastLink-Provisioning.json" -o "$UPDATE_DIR/CastLink-Provisioning.json"
export UPDATE_TAG UPDATE_DIR INSTALL_DIR
python3 - <<'PY'
import hashlib, ipaddress, json, os, re
from pathlib import Path
tag = os.environ['UPDATE_TAG']
assert re.fullmatch(r'easy-setup-[a-f0-9]{12}', tag)
folder = Path(os.environ['UPDATE_DIR'])
checksums = {}
for line in (folder / 'SHA256SUMS').read_text().splitlines():
    digest, name = line.split()
    assert re.fullmatch(r'[a-f0-9]{64}', digest)
    assert name not in checksums
    checksums[name] = digest
metadata = (folder / 'CastLink-Provisioning.json').read_bytes()
assert hashlib.sha256(metadata).hexdigest() == checksums['CastLink-Provisioning.json']
r = json.loads(metadata)
assert re.fullmatch(r'[a-f0-9]{40}', r['commit'])
assert r['commit'].startswith(tag.removeprefix('easy-setup-'))
assert 'vps-update-maintenance-v1' in r['capabilities']
state = json.loads((Path(os.environ['INSTALL_DIR']) / '.castlink-install.json').read_text())
host = str(ipaddress.IPv4Address(state['address']))
assert state['completed'] is True
request = {
    'action': 'update', 'installationId': state['installationId'],
    'host': host, 'origin': 'https://' + host,
    'releaseUrl': 'https://github.com/resokol/castlink-releases/releases/download/' + tag + '/CastLink-Linux.tar.gz',
    'releaseSha256': checksums['CastLink-Linux.tar.gz'],
    'releaseCommit': r['commit'], 'releaseCommitPrefix': r['commit'][:12],
}
(folder / 'update-request.json').write_text(json.dumps(request))
PY
python3 server-provision-vps.py < "$UPDATE_DIR/update-request.json" \
  | tee "$UPDATE_DIR/update-events.jsonl"
curl --fail --show-error https://203.0.113.10/api/version
```

Контрольные суммы нового выпуска в этом примере получаются по HTTPS из его публичного `SHA256SUMS`; при наличии отдельно опубликованной ожидаемой суммы сверьте её дополнительно. Финальный результат должен содержать `outcome: updated` либо `current` и ожидаемый `buildId`. После обновления повторите внешний HTTPS и медиатест. Для сервера, чей адрес/конфигурация были изменены вручную, сначала нужна проверка соответствия этой процедуре.

### Если установка прервалась

Сохраните рабочую папку, `$INSTALL_DIR`, Docker volumes и сообщения об ошибке. Незавершённую установку помощник может продолжить повторным запуском **того же** `install-request.json` с тем же IP, выпуском и неизменёнными файлами. Не повторяйте начальный блок для новой установки: его проверка специально остановится при существующем каталоге. Завершённую установку обслуживайте командами запуска/остановки или `update`.

Если порты заняты, помощник откажется продолжать. Не останавливайте посторонние службы автоматически. При ошибках несовпадения UUID, выпуска, конфигурации или секретов остановитесь и разберите состояние; удаление файлов проверки не исправляет данные.

### Границы инструкции

Этот маршрут охватывает отдельный Ubuntu VPS с публичным IPv4 и штатной конфигурацией помощника опубликованного выпуска. Доступ по домену `example.org`, отдельный TURN TLS, IPv6, NAT/CGNAT и перенос существующих данных требуют отдельной настройки; добавление DNS-записи само по себе не меняет сертификат и адрес установки. Непроверенные возможности из разработки к этому выпуску не относятся.

Команды сверены с упаковкой и служебными программами выпуска. Полная установка по этой инструкции на чистом VPS и реальный эфир в рамках подготовки документа не выполнялись; внешняя выдача сертификата и качество связи проверяются на вашем сервере.



---

[Пошаговая настройка TURN/TLS на TCP 443](TURN_TLS.md)
