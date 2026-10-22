# Ручная установка CastLink на Linux

[Русский](LINUX_MANUAL.md) · [English](docs/en/LINUX_MANUAL.md) · [简体中文](docs/zh-CN/LINUX_MANUAL.md)

Два варианта установки из SSH-терминала: [«Из коробки»](#out-of-box) и [«Расширенный»](#advanced). Windows-мастер не нужен. Здесь используется официальный пакет с возможностями `network-modes-v1` и `linux-compose-v1`; новая инструкция не добавляет их старому пакету. [Общая инструкция](INSTALL.md) · [Руководство](README.md) · [Выпуски](https://github.com/resokol/castlink-releases/releases).

Новые интерактивные шаги ниже относятся к CLI **1.0.0-rc.8**: `init` по умолчанию быстрый, расширенный режим включается флагом `--advanced`. Проверяй наличие флага через `--help`. [Выбор опубликованного Linux-выпуска](PRODUCTS.md). Выбранный ниже пакет использует новый CLI rc.8. Раздел [исторического CLI1472](#legacy-1472) нужен только для старых пакетов.

## Подготовка и проверка пакета

Нужны Ubuntu 22.04/24.04 x86_64 (amd64), Python 3.8+, работающий Docker Engine с Linux-контейнерами и Docker Compose **2.23.1 или новее**, `curl`, `tar` и `sha256sum`. Другие дистрибутивы отдельно не проверены. Подключись по SSH к своему серверу и выполняй примеры из административной оболочки (`sudo -i`, если требуется). Доступ к Docker равносилен административному; все дальнейшие команды должны обращаться к одному Docker Engine и той же папке данных. Не переключай Docker context между командами.

Установи зависимости по инструкциям Ubuntu и [Docker Engine для Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Этот Linux CLI не устанавливает ОС, Python или Docker. Входящий SSH и рабочее подключение сохраняй. Проверь без изменения служб:

```bash
uname -m
python3 --version
docker info --format '{{.OSType}}'
docker compose version
```

Ожидаются `x86_64`, Python 3.8+, `linux` и подходящая версия Compose. Нужны свободные порты и место для образов, БД и резервных копий; 20 ГБ свободного диска — ориентир первого теста, а не измеренный минимум.

Ниже закреплён Linux-выпуск **1.0.0-rc.8**, исходный коммит `72b315b2d251`. Скачивайте архив и суммы из одного выпуска. Для каждого выпуска создавайте новую папку отдельно от постоянных данных:

```bash
set -euo pipefail
umask 077
RELEASE_TAG='linux-v1.0.0-rc.8-72b315b2d251'
mkdir -p /opt/castlink-releases
cd /opt/castlink-releases
mkdir "$RELEASE_TAG"
cd "$RELEASE_TAG"
RELEASE_URL="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
curl --fail --location --proto '=https' "$RELEASE_URL/CastLink-Linux.tar.gz" -o CastLink-Linux.tar.gz
curl --fail --location --proto '=https' "$RELEASE_URL/SHA256SUMS" -o SHA256SUMS
printf '%s  %s\n' '42ec2b981f53eba107369905a78bd6d31bf130e2fed90a2fa217c4cc72c39add' 'CastLink-Linux.tar.gz' | sha256sum --check -
sha256sum --check --ignore-missing SHA256SUMS
tar --extract --gzip --file CastLink-Linux.tar.gz
python3 -c 'import json; r=json.load(open("payload/release.json")); assert {"network-modes-v1","linux-compose-v1"} <= set(r.get("capabilities", [])); print(r["commit"])'
python3 scripts/linux-compose-setup.py --help
CASTLINK_STATE=/opt/castlink-manual
```

Продолжай только после `CastLink-Linux.tar.gz: OK` и успешной проверки возможностей. Повторное `mkdir` существующей папки специально прервёт пример: не распаковывай новый выпуск поверх старого. CLI также сверяет файлы и архив образов с `payload/release.json`. Образы включены в пакет; собирать приложение и скачивать образы с Docker Hub не требуется.

Постоянная папка `/opt/castlink-manual` должна быть новой и приватной. `init` создаёт её с режимом 0700, а файлы конфигурации и секретов — 0600; `umask 077` защищает также создаваемые оператором файлы. Не используй папку установки Windows-мастера: CLI не принимает его state и не переносит его установку.

<a id="legacy-1472"></a>
## Исторический CLI1472: прежние вопросы

В пакете `easy-setup-1472cd052d7e` нет флага `--advanced`. Выполни команду ниже и выбери `quick` либо `advanced` в первом вопросе. В quick затем вводятся внешний адрес, media IPv4 и ответ о публичном сертификате; advanced продолжает сетевыми параметрами. Это описание старого пакета, а не вопросы нового rc.8 CLI. Общие JSON-примеры и команды start/status/update ниже применимы к обоим, если manifest объявляет указанные возможности.

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --lang ru
```

| Вопрос | Публичный VPS | Локальная сеть |
| --- | --- | --- |
| Режим | `quick` | `quick` |
| Внешний адрес | `https://meet.example.com` или HTTPS с твоим публичным IPv4 | Например, `https://192.168.1.50` |
| IPv4 сервера для медиа | Доступный клиентам публичный IPv4 | IPv4 сервера в LAN |
| Публичный HTTPS сертификат? | `yes` | `no` — собственный CA |

<a id="out-of-box"></a>
## «Из коробки»: HTTPS и стандартные порты

Подходит для отдельного публичного VPS или LAN-сервера. Для VPS заранее направь A-запись домена на публичный IPv4 сервера либо используй сам публичный IPv4. DNS и NAT CLI не настраивает. Для LAN выбери адрес, доступный клиентским устройствам.

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --lang ru
```

В CLI rc.8 быстрый режим включён по умолчанию: введи домен или IPv4 сервера; `https://` можно опустить. Отдельного выбора `quick` и вопроса о сертификате нет. Для домена с одним IPv4 A-адресом media IPv4 берётся из DNS; если DNS отсутствует или неоднозначен, CLI дополнительно спросит IPv4 сервера. Публичный сертификат выбирается для глобального media IPv4, собственный CA — для частного/loopback. Ручной выбор сертификата и сети доступен через `--advanced`.

Замени примеры своими адресами. Значения по умолчанию `127.0.0.1` доступны только самому серверу; не оставляй их для удалённых клиентов. Быстрый режим использует HTTPS, HTTP/HTTPS 80/443, media TCP 7881, media UDP 7882, TURN UDP 3478 и relay UDP 30000–30031. Caddy привязывается к `0.0.0.0`, если media IPv4 не loopback.

Неинтерактивный эквивалент для **примерного LAN-адреса**: сохрани как `quick.json`, замени IP и проверь:

```json
{
  "setupMode": "quick",
  "publicHttps": false,
  "network": {
    "mode": "https",
    "publicOrigin": "https://192.168.1.50",
    "bindAddress": "0.0.0.0",
    "httpPort": 80,
    "httpsPort": 443,
    "mediaIp": "192.168.1.50",
    "iceTcpPort": 7881,
    "iceUdpPort": 7882,
    "turnUdpPort": 3478,
    "relayPortStart": 30000,
    "relayPortEnd": 30031,
    "trustedProxies": []
  }
}
```

```bash
python3 scripts/linux-compose-setup.py validate --config quick.json --lang ru
# Вместо интерактивного init, только для ещё не созданной установки:
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --config quick.json --lang ru
```

`init` подготавливает конфигурацию и генерирует служебные секреты; сообщение «Готово» на этом шаге ещё не означает запуск сервера. Пароль комнаты или студии CLI не спрашивает и не выводит. Для запуска:

```bash
python3 scripts/linux-compose-setup.py start --state-dir "$CASTLINK_STATE" --lang ru
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang ru
```

`start` загружает образы, запускает Compose, выполняет миграции/первичную подготовку БД и конфигурацию сайта. Для прямого HTTPS он проверяет Caddy и ожидаемую версию с проверкой сертификата. `status` показывает сохранённые `completed`, `readiness`, commit и текущее состояние контейнеров; сохранённый успех не заменяет текущую проверку сайта.

При `publicHttps: true` Caddy получает публичный сертификат. Нужны корректный DNS/публичный адрес и доступные ACME-порты; стандартная схема использует TCP 80/443. При `false` используется собственный CA. CLI **не устанавливает доверие на клиентских устройствах** и не создаёт Windows-комплект доверия. После успешного `start` можно выгрузить только публичный корневой сертификат:

```bash
docker compose -f "$CASTLINK_STATE/compose.json" exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > "$CASTLINK_STATE/castlink-root-ca.crt"
```

Проверь происхождение сертификата на своём сервере и установи его в доверенные корневые сертификаты каждого клиентского устройства по правилам его ОС/браузера. Передавай только `castlink-root-ca.crt`, не папку с секретами. Для проверки с сервера: `curl --fail --cacert "$CASTLINK_STATE/castlink-root-ca.crt" https://192.168.1.50/api/version`. Замени адрес своим. Нажатие «продолжить» в предупреждении браузера не заменяет доверие CA.

<a id="advanced"></a>
## «Расширенный»: свои порты, HTTP или внешний HTTPS-прокси

Для CLI rc.8 запусти явный расширенный режим:

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --advanced --lang ru
```

Он спрашивает `https/http/proxy`, внешний адрес, media IPv4, сертификат для HTTPS, IPv4 привязки Caddy, все порты и доверенные IPv4/CIDR для proxy. Либо передай полный JSON через `--config`: интерактивных вопросов тогда нет. Флаг `--advanced` относится только к новому интерактивному init; существующие настройки он не заменяет. Старый1472 использует выбор режима в вопросе. Windows-флаг `-NetworkConfigPath` здесь не используется.

Пример `advanced.json` для HTTPS-прокси на **том же хосте**, который передаёт запросы внутреннему Caddy по HTTP:

```json
{
  "setupMode": "advanced",
  "publicHttps": false,
  "network": {
    "mode": "proxy",
    "publicOrigin": "https://meet.example.com",
    "bindAddress": "127.0.0.1",
    "httpPort": 8080,
    "httpsPort": 443,
    "mediaIp": "203.0.113.8",
    "iceTcpPort": 7881,
    "iceUdpPort": 7882,
    "turnUdpPort": 3478,
    "relayPortStart": 30000,
    "relayPortEnd": 30031,
    "trustedProxies": ["172.17.0.1/32"]
  }
}
```

Домен, `203.0.113.8` и `172.17.0.1/32` — примеры, не готовые параметры твоего сервера. `trustedProxies` содержит адрес исходящего прокси, **который видит Caddy в Docker**, а не адрес браузера. Docker NAT может заменить localhost адресом gateway. Установи фактический адрес/подсеть своего маршрута; не копируй пример вслепую. Доверие `0.0.0.0/0` запрещено. Если прокси на другой машине/в контейнере, выбери достижимый приватный `bindAddress` и разреши доступ к HTTP listener только своему прокси.

```bash
python3 scripts/linux-compose-setup.py validate --config advanced.json --lang ru
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --config advanced.json --lang ru
python3 scripts/linux-compose-setup.py start --state-dir "$CASTLINK_STATE" --lang ru
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang ru
```

Выполняй этот `init` вместо быстрого варианта для новой установки. Повторный `init` сохраняет существующие настройки; он не переключает действующую установку на новый JSON.

| Поле | Значение |
| --- | --- |
| `setupMode` | `quick` или `advanced`; в JSON все сетевые поля всё равно обязательны |
| `publicHttps` | JSON boolean: публичный сертификат для прямого HTTPS; при `false` — свой CA. Для proxy/http укажи `false` |
| `network.mode` | `https` — Caddy завершает TLS; `http` — без TLS; `proxy` — TLS завершает внешний прокси |
| `publicOrigin` | Полный внешний origin без пути/учётных данных, например `https://meet.example.com:8443` |
| `bindAddress` | IPv4 прослушивания сайта на Docker-хосте; не адрес для публикации media |
| `mediaIp` | Конкретный IPv4 сервера, достижимый клиентами; не домен и не `0.0.0.0` |
| `httpPort / httpsPort` | Целые числа 1–65535. Для прямого режима порт origin совпадает с соответствующим портом; proxy может иметь другой внешний порт |
| `iceTcpPort / iceUdpPort / turnUdpPort` | Media TCP / media UDP / TURN UDP, по умолчанию 7881 / 7882 / 3478 |
| `relayPortStart / relayPortEnd` | Включительный диапазон UDP relay, 1–1024 порта; по умолчанию 30000–30031 |
| `trustedProxies` | Массив IPv4/CIDR; непустой только для `proxy`, иначе `[]` |

Не допускай коллизий портов одного протокола. Открой выбранные порты в firewall, панели провайдера и NAT с сохранением номеров. Для прямого публичного HTTPS на нестандартном HTTP-порту ACME HTTP-01 требует маршрута с внешнего TCP 80 на этот порт; произвольный порт сам сертификат не обеспечит. HTTP вне localhost обычно запрещает браузеру камеру, микрофон и показ экрана.

Внешний прокси должен иметь действующий сертификат и передавать все пути, включая `/rtc`, WebSocket Upgrade, Host и проверенные forwarded-заголовки. Примеры Nginx/Caddy — в [INSTALL.md](INSTALL.md#работа-за-внешним-прокси). Caddy CastLink сохраняет media-admission; прокси сайта не заменяет media-порты. Этот standalone CLI настраивает TURN/UDP; TURN/TLS 443 автоматически не добавляется. PostgreSQL и web:3000 наружу не публикуются.

В режиме `proxy` успешный `start` означает `readiness: local-ingress-only`: внутренний HTTP проверен, внешний HTTPS ещё нет. Проверь с другого устройства `https://meet.example.com/api/version`, вход в комнату и реальные камера/микрофон/экран, затем получение аудио/видео в целевом браузере или OBS/vMix. Для прямого HTTPS тоже проверь внешний маршрут и медиа отдельно.

## Диагностика и обновления

При новом SSH-сеансе снова задай `CASTLINK_STATE=/opt/castlink-manual` и перейди в папку нужного распакованного выпуска. Сначала смотри состояние именно этой установки:

```bash
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang ru
docker compose -f "$CASTLINK_STATE/compose.json" config --quiet
docker compose -f "$CASTLINK_STATE/compose.json" ps
docker compose -f "$CASTLINK_STATE/compose.json" logs --tail 100
```

Для сетевой ошибки сверяй DNS, firewall, занятые порты, адрес media, доверие сертификату и маршрут прокси. Не публикуй env/state/secrets, приглашения и необработанные логи. `render` переписывает сгенерированную конфигурацию из сохранённого state; ручные правки этих файлов могут быть потеряны.

Следующие команды доступны в новом пакете с возможностями `public-updates-v1` и `production-retention-v1`. Уже опубликованный rc.8 сам эти возможности не получает: сначала установи новый пакет. Проверь список через `--help`.

При интерактивном запуске `start` или `status` CLI проверяет отдельный Linux-канал GitHub Releases. Если есть новая версия, можно обновить, остаться на текущей или ввести `off`, чтобы отключить автоматические проверки. Проверка без сети не останавливает сервер; неинтерактивные команды не задают вопросов.

```bash
python3 scripts/linux-compose-setup.py check-updates --state-dir "$CASTLINK_STATE" --lang ru
python3 scripts/linux-compose-setup.py update --state-dir "$CASTLINK_STATE" --lang ru
python3 scripts/linux-compose-setup.py updates --auto-check off --state-dir "$CASTLINK_STATE"
python3 scripts/linux-compose-setup.py updates --auto-check on --state-dir "$CASTLINK_STATE"
```

`update` скачивает актуальный полный Linux-выпуск из публичного GitHub, проверяет размер, SHA256 и manifest, затем устанавливает его. Для заранее скачанного и проверенного пакета используй `update --package /путь/к/распакованному/пакету`. Перед обновлением заверши эфиры: службы перезапускаются. UUID, секреты, сеть и тома сохраняются.

Автоматические бэкапы не создаются; команда `backup` удалена из пользовательского CLI. После успешной проверки новой версии удаляются прежние неиспользуемые образы, зарегистрированные этой установкой, и временная загрузка. Образы других контейнеров, включая остановленные, и соседних установок сохраняются. Старые автоматически созданные Linux-бэкапы удаляются только при совпадении UUID установки, полного набора файлов и всех контрольных сумм; ручные и неизвестные копии сохраняются.

При сбое обновления очистка прежних образов не выполняется. Устрани причину и запусти `start` с той же папкой состояния: он использует установленный набор образов без повторного скачивания старого пакета. Автоматического восстановления БД/данных нет. Не используй `down -v` или общий `docker system prune`.
