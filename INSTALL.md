# Установка CastLink: быстрый и расширенный режимы

[Русский](INSTALL.md) · [English](docs/en/INSTALL.md) · [简体中文](docs/zh-CN/INSTALL.md)

Эта инструкция относится к пакетам с возможностями `network-modes-v1` и `linux-compose-v1`. Старые выпуски не получают эти возможности от обновления документации.

## Выбор пакета и обычная установка

[Три пакета и отдельные ссылки скачивания](PRODUCTS.md): **Client** подключает участника к серверу, **Server Setup** устанавливает сервер на ПК/VPS из Windows, **Linux** устанавливает сервер без Windows-мастера. Текущий кандидат — **1.0.0-rc.8**; ссылки на странице выбора сохраняют последнюю опубликованную версию до проверки новых пакетов. Направления обновляются независимо, переход на 1.1 пока отложен.

Обычная установка использует стандартные настройки. Технические параметры открываются явно через расширенный режим. Клиент Windows устанавливается для текущего пользователя одним действием. В Server Setup расширенные настройки необязательны; стандартный SSH-порт — сохранённый либо 22. В Linux `init` по умолчанию быстрый, для расширенного режима добавьте `--advanced`; адрес сайта задаёт HTTPS и медиа IPv4, а дополнительный IPv4 запрашивается только при неоднозначном или отсутствующем DNS. При обновлении сохраняются существующие настройки.

## Windows: выбор при установке

Распакуй весь `CastLink-Windows.zip` и открой `EasySetup.exe`. Обычная установка использует быстрый режим; расширенные настройки включаются отдельно:

- **Быстрая (рекомендуется)** — обычный HTTPS, стандартные порты, автоматические секреты и настройка базы. Укажи место установки и адрес. Локально используется собственный сертификат с комплектом доверия; на VPS — публичный сертификат. Отдельные резервные серверы можно добавить позже.
- **Расширенная** — HTTPS напрямую, HTTP либо внешний HTTPS-прокси; внешний адрес сайта, IPv4 привязки, порты сайта, доверенные прокси, отдельный IPv4 медиа, TCP/UDP медиа и диапазон TURN. Доступен ввод JSON-конфигурации через `-NetworkConfigPath`.

Кнопки языка переключают русский, английский и упрощённый китайский, сохраняя введённые значения. При обновлении выбирай прежнюю установку: мастер сохраняет её сеть, UUID, секреты и тома. Смена сетевой схемы обновлением не выполняется автоматически.

Для запуска из PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-simple-easy-setup.ps1 -SetupMode advanced -NetworkConfigPath network.json
```

## Linux без Windows-мастера

Отдельное руководство для SSH-терминала: [«Из коробки»](LINUX_MANUAL.md#out-of-box) · [«Расширенный»](LINUX_MANUAL.md#advanced). Оно включает проверку пакета, JSON, сертификаты и обновление.

Нужны Linux amd64, Python 3.8+, Docker и Docker Compose v2. Используй официальный `CastLink-Linux.tar.gz` с совпадающей контрольной суммой из `SHA256SUMS`. Распаковывай каждый выпуск в отдельную папку. Установщик проверяет содержимое пакета по manifest; Docker Hub и доступ к приватному GitHub для образов не нужны.

Из распакованного пакета:

```bash
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --lang ru
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang ru
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang ru
```

Для другого языка замени `ru` на `en` или `zh-CN`. `init` по умолчанию использует быстрый режим и создаёт конфигурацию (для расширенного добавь `--advanced`); `start` загружает образы пакета, запускает службы и подготавливает базу. Быстрый локальный HTTPS требует доверия созданному CA на клиентских устройствах. Публичный HTTPS требует рабочего DNS/публичного IP и доступности ACME-портов. Готовность настоящего аудио/видео проверь отдельным подключением.

Постоянная папка `/opt/castlink-manual` содержит `compose.json`, `Caddyfile`, `livekit.json`, env-файлы и приватные state/secrets. Не публикуй её содержимое. Храни эту папку отдельно от распакованных выпусков и сохраняй резервные копии. Windows-мастер и Linux CLI управляют собственными установками; CLI откажется принимать установку Windows-мастера.

## Работа за внешним прокси

```text
Браузер → HTTPS → Nginx/Caddy → HTTP → Caddy CastLink → приложение
Медиаподключение → отдельные порты LiveKit/TURN
```

Пример `network.json` для прокси на том же сервере:

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

Замени домен, mediaIp и trustedProxies своими значениями. `203.0.113.8` — пример, не рабочий адрес. `trustedProxies` — адрес исходящего прокси, **который видит Caddy внутри Docker**, а не адрес браузера. Docker может заменить localhost адресом gateway; проверь свой адрес/подсеть. Доверие `0.0.0.0/0` запрещено. Для прокси в другой машине/контейнере укажи доступный приватный `bindAddress` вместо localhost и разреши доступ только этому прокси.

Linux принимает весь JSON выше:

```bash
python3 scripts/linux-compose-setup.py validate --config network.json --lang ru
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --config network.json --lang ru
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang ru
```

Внешний Caddy на этом же хосте:

```caddyfile
meet.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Пример внешнего Nginx (укажи собственные файлы сертификата):

```nginx
server {
    listen 443 ssl;
    server_name meet.example.com;
    ssl_certificate /etc/ssl/meet/fullchain.pem;
    ssl_certificate_key /etc/ssl/meet/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

Передавай все пути, включая `/rtc` и WebSocket. Внутренний Caddy сохраняет проверку `/api/media-admission`, отбрасывает поддельные заголовки недоверенных источников и передаёт приложению проверенный IP клиента. Проверка внутреннего HTTP не подтверждает готовность внешнего HTTPS-прокси: проверь `https://meet.example.com/api/version` и вход в комнату с другого устройства.

## HTTP, HTTPS и порты

Обычный HTTP вне localhost не обеспечивает браузерный доступ к камере, микрофону и показу экрана. Для пользователей LAN/интернета выбирай HTTPS либо внешний HTTPS-прокси. HTTPS может работать и внутри LAN через собственный CA; предупреждение браузера само по себе не устанавливает доверие сертификату.

Прямой публичный HTTPS по умолчанию использует TCP 80/443. Если меняешь опубликованный HTTP-порт, для ACME HTTP-01 нужно перенаправление внешнего TCP 80 на этот порт; один произвольный порт не делает выдачу сертификата доступной. Порт в `publicOrigin` должен совпадать с выбранным портом прямого HTTP/HTTPS. В режиме прокси внешний порт и внутренний HTTP-порт различаются.

По умолчанию медиа использует TCP 7881, UDP 7882, TURN UDP 3478 и UDP 30000–30031. Открой выбранные порты в firewall/панели провайдера и настрой NAT с сохранением номеров. Внешний прокси сайта не заменяет медиамаршрут. База и web:3000 отдельно в интернет не публикуются. TURN/TLS 443 мастера совместим только с прямым публичным HTTPS, стандартными 80/443 и отдельным доменом TURN; внешний прокси не превращается автоматически в TURN-прокси.

## Обновление и резервные копии Linux

Заверши эфиры перед обновлением: службы будут перезапущены. Из **нового** проверенного распакованного пакета, с той же постоянной папкой:

```bash
python3 scripts/linux-compose-setup.py backup --state-dir /opt/castlink-manual --lang ru
python3 scripts/linux-compose-setup.py update --state-dir /opt/castlink-manual --lang ru
```

`update` сам создаёт дополнительную проверенную копию PostgreSQL, web-data и конфигурации перед загрузкой новых образов. Для согласованности файлов web кратковременно приостанавливается и возобновляется даже при ошибке копирования. UUID, секреты, сеть и имена томов сохраняются. При неудаче не удаляй папку и тома: сохрани диагностику и резервную копию; повтор `start` предназначен для завершения выбранного выпуска. Автоматического отката БД/данных нет: старый код может быть несовместим с новой схемой.

Прямые команды Compose доступны для диагностики из постоянной папки:

```bash
docker compose -f compose.json config --quiet
docker compose -f compose.json ps
docker compose -f compose.json logs --tail 100
```

Логи перед передачей проверь на секреты. Не используй `down -v`: этот флаг удаляет постоянные тома.

