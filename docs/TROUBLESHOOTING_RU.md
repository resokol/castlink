# Если что-то не работает

Здесь **нормальный вывод — пример**, а не обещание точного совпадения версии, времени или SHA. После разовой команды можно выполнить `echo $?`: `0` означает успешное завершение. Делайте это сразу: другая команда заменит код результата. У работающего dev/start процесса приглашение терминала не возвращается до Ctrl+C — это нормально.

**Локально** — терминал своего компьютера, обычно `user1@…`. **На VPS** — терминал после SSH, обычно `root@Lynkserver2`. Не копируйте текст приглашения терминала вместе с командой.

## 1. Найти проект и инструменты — локально

```bash
cd ~/studiolink
pwd
node --version
pnpm --version
git status --short
```

Норма: `/home/user1/studiolink`, Node `v22.…`, pnpm `9.15.0`. Пустой `git status --short` означает отсутствие изменений. ` M путь` — изменённый файл, `?? путь` — новый, ещё не добавленный в Git. Это не ошибки.

Если `cd` пишет «Нет такого файла», найдите папку проекта, не запускайте установку в случайном каталоге. Если pnpm отсутствует при установленном Node/Corepack:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

Норма последней команды: `9.15.0`. При `EACCES` не меняйте рекурсивно права системных каталогов; установка Node должна быть доступна вашему пользователю либо настраивается администратором. Если Corepack отсутствует, сначала настройте Node 22 с подходящим менеджером пакетов.

Поиск без ripgrep:

```bash
grep -n -C 4 -E 'GuestPreview|TrackSubscribed|setGuests' apps/web/app/studio/page.tsx
```

Норма — номера строк и найденные фрагменты. Нет вывода и код `1` у grep означает «совпадений нет», а не поломку проекта. Если `rg` установлен, аналогично `rg -n -C 4 'GuestPreview|TrackSubscribed|setGuests' apps/web/app/studio/page.tsx`.

## 2. Зависимости и проверка кода — локально

```bash
pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
```

Установка заканчивается без `ERR_PNPM`; возможны `Already up to date` и `Done in …`. Проверка TypeScript обычно ничего не выводит и возвращает `0`. `error TS…` с путём и строкой — открыть именно это место. `ERR_PNPM_OUTDATED_LOCKFILE` означает несогласованные package.json/lockfile: выясните, почему изменились зависимости, прежде чем пересоздавать lockfile. Ошибка DNS/timeout — проверить сеть; не удалять исходники.

Один тест без запуска сервера:

```bash
node apps/web/tests/guest-entry.cjs
```

Норма:

```text
PASS: two-field guest entry, no cookie auto-bypass, wrong/correct passwords, invitation bypass and invalid-link fallback
```

Другие самостоятельные проверки:

```bash
node apps/web/tests/monitor-audio.cjs
node apps/web/tests/telemetry.cjs
node apps/web/tests/room-mode-monitoring.cjs
node apps/web/tests/studio-video-recovery.cjs
node apps/web/tests/app-update.cjs
node apps/web/tests/video-quality.cjs
node apps/web/tests/app-update-notice.cjs
```

Каждая исправная проверка заканчивается строкой `PASS: …` и кодом `0`. `AssertionError` — проверка не прошла. `MODULE_NOT_FOUND` — не найден модуль или тестовый загрузчик не умеет разрешить импорт.

**Известные на 26.09.2026 отказы:** `video-quality.cjs` ожидает `{ exact: 1920 }`, но ручная правка выдаёт `{ ideal: 1920 }`; `app-update-notice.cjs` не разрешает импорт `@/components/ThemeToggle`. Эти два отказа зафиксированы, а не исправлены документацией. Сначала согласуйте требуемое поведение/загрузчик, затем меняйте тест. Не заменяйте ожидаемый результат только ради зелёной проверки.

API-тесты из списка в [гайде](PROJECT_GUIDE_RU.md) не входят в этот набор: им нужен изолированный сервер и тестовые настройки. Не запускайте их с адресом рабочего сайта.

## 3. Запустить сайт — локально

```bash
cd ~/studiolink
NEXT_BUILD_DIR=.next-dev STUDIOLINK_ROOMS_FILE="$PWD/apps/web/.studiolink-data/rooms.json" STUDIOLINK_STATS_DIR="$PWD/apps/web/.studiolink-data/stats" pnpm --filter web exec next dev -H 127.0.0.1 -p 3000
```

Норма примерно:

```text
▲ Next.js 15.5.…
Local: http://127.0.0.1:3000
✓ Ready in …
```

Откройте `http://localhost:3000/studio`. Во втором терминале:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/studio
```

Норма: `200`. `000`/`Failed to connect` — процесс не слушает порт. `500` — смотрите терминал Next.js. Наличие 200 проверяет страницу, но не видеосвязь.

При `EADDRINUSE`:

```bash
ss -ltnp 'sport = :3000'
```

Норма при уже работающем сайте: строка `LISTEN`, адрес с `:3000`, процесс node/next (имя зависит от запуска). Остановите свою предыдущую задачу Ctrl+C. Не выполняйте `killall node`: он завершит другие приложения. Не переносите бездумно на порт 3001: логика локального URL LiveKit сейчас учитывает порт 3000.

## 4. Пересобрать и проверить версию — локально

Остановите локальный сервер перед заменой его сборки. Из корня проекта:

```bash
NEXT_BUILD_DIR=.next-local STUDIOLINK_RELEASE=local-manual pnpm --filter web build
```

Норма: `Compiled successfully`, завершённая проверка типов/генерация страниц, таблица маршрутов и код `0`. Предупреждение само по себе не равно провалу; `Failed to compile`, `Killed`, ненулевой код — сборка не завершена. При `Killed` проверьте память (`free -h`), при ошибке типов — указанный файл.

После успешной сборки:

```bash
NEXT_BUILD_DIR=.next-local STUDIOLINK_ROOMS_FILE="$PWD/apps/web/.studiolink-data/rooms.json" STUDIOLINK_STATS_DIR="$PWD/apps/web/.studiolink-data/stats" pnpm --filter web exec next start -H 127.0.0.1 -p 3000
```

Норма: `Ready in …`. Во втором терминале:

```bash
cat apps/web/.next-local/BUILD_ID
curl -fsS http://127.0.0.1:3000/api/version
```

Норма: файл содержит `local-manual`, API возвращает `{"version":"local-manual"}`. JSON может напечататься вплотную к приглашению терминала — это нормально, у ответа нет завершающего переноса строки. Сообщение `Could not find a production build` означает, что build не завершён либо start использует другой `NEXT_BUILD_DIR`. Не исправляйте это командой `docker cat`: для файла на хосте применяется `cat`.

## 5. На одном компьютере старая версия

На любом компьютере с интернетом:

```bash
curl -fsS https://lunkaonline.ru/api/version
```

Во время подготовки гайда проверен ответ `{"version":"0.9.2-fullhd"}`. После нового релиза нормальным будет новый идентификатор. Сравните точный домен/адрес на обоих устройствах: IP, localhost и домен могут вести к разным серверам.

Если сервер отдаёт новый release, а интерфейс старый: завершите звонок, нажмите «Проверить обновления» и подтвердите обновление, либо Ctrl+Shift+R. Если сервер возвращает старый release, перезагрузка браузера не установит новый Docker-образ — нужен выпуск на VPS. Проверка версии не тестирует камеру и звук.

## 6. Проверить VPS без изменения настроек

Подключение с локального компьютера:

```bash
ssh root@168.113.157.48
```

Норма: вход и приглашение сервера. При первом подключении проверьте отпечаток ключа через доверенную панель провайдера перед подтверждением. `Permission denied` — неверный способ входа/пароль/ключ; `Connection timed out` — доступность или firewall. Не публикуйте пароль в Issue.

Далее команды **на VPS**:

```bash
hostname
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker compose -f /opt/studiolink/docker-compose.yml config --services
```

Норма: имя вашего сервера; web и медиасервисы в `Up …`; список сервисов compose (например web, livekit, caddy — реальные имена сверить). `Restarting` — цикл падений. Отсутствие web — контейнер не работает. Если Caddy установлен как системная служба, его не будет в docker ps; это надо учитывать по фактической конфигурации.

```bash
docker logs --tail 100 studiolink-web
curl -fsS http://127.0.0.1:3000/api/version
curl -fsS https://lunkaonline.ru/api/version
```

Норма: Next.js готов, без повторяющихся аварий; обе версии совпадают. Если `No such container`, возьмите имя из docker ps. Если localhost работает, а домен нет — проверяйте прокси/DNS/TLS. Если оба не работают — сначала web-контейнер. В логах могут быть личные данные: просматривайте перед отправкой.

Проверить только пути монтирования, без вывода env-секретов:

```bash
docker inspect studiolink-web --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
df -h /
free -h
```

Норма: ожидаемые постоянные каталоги данных (в ранее настроенной схеме `/opt/studiolink/data -> /data` и `data/runtime -> /tmp`), свободное место в `Avail`, доступная память в `available`. Нет единого «правильного» количества гигабайт; 100% диска и ошибки OOM ненормальны. Не удаляйте data/runtime ради освобождения места.

Проверка образа известного релиза:

```bash
docker image inspect studiolink_web:fullhd-v0.9.2 --format '{{.Id}}'
```

Норма: `sha256:…`. Это доказывает наличие образа, но не то, что контейнер запущен из него. Запущенный тег смотрите в `docker ps`. Если сборка ранее писала статус в файл:

```bash
cat /tmp/fullhd-v0.9.2-build.exit
```

`0` — процесс той сборки завершился успешно. `No such file` означает только отсутствие файла: он мог не создаваться или исчезнуть после перезагрузки. Это не доказательство отсутствия образа.

Перезапуск уже установленного web-контейнера, **прерывает подключённые сессии и не пересобирает код**:

```bash
docker restart studiolink-web
```

Норма: имя контейнера. Затем снова проверьте логи и API. Используйте только когда нужен именно перезапуск; для установки изменённых исходников нужен новый образ и пересоздание web-сервиса с ним.

## 7. DNS и HTTPS

На локальном компьютере:

```bash
getent ahostsv4 lunkaonline.ru
curl -I --connect-timeout 10 https://lunkaonline.ru/studio
```

Для прямой текущей схемы ожидается IP `168.113.157.48` (несколько строк STREAM/DGRAM/RAW допустимы), HTTP `200`. При будущей смене сервера/CDN ожидаемый IP изменится. Ошибка сертификата — проверить домен, срок сертификата и прокси; не обходить её постоянным `-k`. При 502 прокси доступен, но не получает ответ web. При timeout проверить сервер и сетевые правила.

## 8. Камера, микрофон или наушники отсутствуют

На проблемном устройстве откройте сайт через HTTPS или локальный localhost. В настройках сайта разрешите камеру/микрофон; закройте другое приложение, захватившее устройство; обновите страницу. В DevTools → Console можно выполнить вручную:

```javascript
window.isSecureContext
typeof navigator.mediaDevices?.getUserMedia
typeof HTMLMediaElement.prototype.setSinkId
```

Ожидается `true`, `"function"`; для выбора выхода — `"function"` в поддерживающем браузере. `undefined` у `setSinkId` означает, что этот механизм вывода недоступен; выберите устройство в настройках ОС. Это не исправляется повышением битрейта.

После предоставления разрешений:

```javascript
console.table((await navigator.mediaDevices.enumerateDevices()).map(d => ({kind: d.kind, label: d.label})))
```

Ожидаются строки `videoinput`, `audioinput`; `audiooutput` зависит от браузера/разрешений. Пустые названия до разрешения допустимы. `NotAllowedError` — отказ доступа; `NotFoundError` — устройство отсутствует/старый deviceId; `NotReadableError` — занято или ошибка драйвера; `OverconstrainedError` — запрошенные ограничения не поддержаны. Для старого deviceId повторно выберите доступное устройство либо системное устройство по умолчанию.

## 9. vMix не принимается как Full HD

Локально проверить ограничения исходника:

```bash
grep -n -E 'width:|height:|frameRate:|maxBitrate:' apps/web/lib/video-quality.ts
```

В текущей ручной правке ожидаются `width: { ideal: 1920 }`, `height: { ideal: 1080 }`. В опубликованном старом коде может быть `exact`. `ideal` устраняет жёсткое требование, но не гарантирует Full HD. Убедитесь, что запущена сборка с нужной правкой, затем проверьте формат vMix External и фактическую отправку в статистике StudioLink.

Для отдельной проверки захвата в Console браузера (предварительно остановите передачу/проверку камеры в приложении):

```javascript
const cameraList = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
console.table(cameraList.map((d, index) => ({index, label: d.label})));
```

Найдите индекс vMix и вместо `0` ниже подставьте его:

```javascript
const chosenCamera = cameraList[0];
const probeStream = await navigator.mediaDevices.getUserMedia({video: {deviceId: {exact: chosenCamera.deviceId}, width: {ideal: 1920}, height: {ideal: 1080}, frameRate: {ideal: 60, max: 60}}, audio: false});
try { console.log(probeStream.getVideoTracks()[0].getSettings()); }
finally { probeStream.getTracks().forEach(track => track.stop()); }
```

Желаемый результат: `width: 1920`, `height: 1080`, `frameRate: 60` (может быть дробным). Иные значения показывают фактический выбор браузера. Это проверка захвата, не сетевой передачи. После теста снова включите проверку Studio Return. Если тест не освободил камеру из-за прерванного выполнения, закройте вкладку.

## 10. Плитки наслаиваются или видео чёрное

Сначала отличите видеопетлю от лишних элементов страницы. Если внутри одной картинки повторяется весь экран студии, подайте на выход vMix тестовую картинку вместо захвата страницы StudioLink. Исчезновение повторений укажет на обратную связь источника. Если добавляются самостоятельные карточки с заголовками, проверьте DOM:

```javascript
document.querySelectorAll('.studio-video-wall > .studio-video-card').length
```

На студийной странице ожидается одна карточка Studio Return плюс число показанных гостей. Сравните до и после ожидания/входа/выхода гостя. Постоянное число карточек при рекурсии внутри видео не указывает на размножение React-компонентов.

Если звук идёт, а видео чёрное: проверьте, включено ли личное видео, режим комнаты, выбранный источник и ON AIR; посмотрите FPS/битрейт приёма. В Chrome `chrome://webrtc-internals` показывает отчёты соединения: у активного входящего видео `framesDecoded` должен расти; у исходящего — `framesEncoded`/`bytesSent`. Рост байтов без декодирования помогает отличить транспорт/декодер от CSS. Не публикуйте полный дамп без просмотра сетевых адресов и идентификаторов.

## 11. Что приложить к сообщению об ошибке

Дата/время, устройство/браузер, адрес страницы без инвайта/токена, `/api/version`, точные шаги, ожидаемое и фактическое поведение, сообщение ошибки, результаты относящихся к проблеме команд. Для сборки — первая содержательная ошибка и код завершения; для экрана — размер окна и скриншот. Не присылайте целиком `.env`, docker inspect с Environment, пароли и cookies.
