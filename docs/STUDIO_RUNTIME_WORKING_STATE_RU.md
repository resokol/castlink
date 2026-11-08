# Основная студия: рабочее состояние — 08.11.2026

## Установлены мобильные пропорции «Окна» и оранжевый URL — 08.11.2026

castlink.ru: `1.0.0-rc.9-ce4964f14302`, source
`ce4964f14302b582a3c5354e2c8eda677f7666ef`, tree
`8317e7451b65be623fdabf70b0ec463abd6b1141`. Переключено22:44:46UTC.
Image: `sha256:89c1805c8bc1f3d4e6795b41a2eb7ae9b66eac36c3b03914e9defe9a26d96c0b`.

Владелец уточнил именно пропорции на фото мобильного «Окна», не режим«Плитка».
Основная рамка и вторичные теперь16:9, видео сохраняется целиком черезcontain.
При393×730 main363×204.1875 вместо363×358.72, вторичный194×109 вместо363×121.28.
Расчёт11строкConferenceScene.tsx учитывает доступную высоту и одиночный кадр;
длинная лента прокручивается локально. Desktop/landscape/Tiles, pin/sourcepriority,
mediaowners и8-кнопочнаяпанель не менялись. КнопкаCopyURLосновнойстудии оранжевая
с контрастным тёмным значком, hover светлее; зелёное подтверждение иonCopy прежние.
Обновление интерфейса: обновить вкладку браузера.

Browser22сценария подтверждены20initial+2tabletretargetпослекорректировки
fixturephone-minimumкпрежнемуdesktopcontract;3Studioorangeконтекста PASS.
Rootпросмотрелexact393послеfix иобетемыStudio. TSCexit0,3conferenceunit,
independentGPT-6.1Solhighreviewбеззамечаний;343stabletestsPASS262+81после
регенерацииmanualmap1858. Нетruntimeизмененийпослеfreeze.
Доказательства /workspace/caster-window-proportions-confirm,
caster-window-proportions-tablet-confirm иstudio-copy-orange-proof.
Тестовые локальные потоки, не liveSFU/RemotePC проверка.

Official whole-image build/Windows+VPS isolation/48compiledfeatures/7точных
публичныхJS/CSSхешей PASS; rootотдельноподтвердилHTTPS /api/version.
До22:40:56UTC был1participant/0tracks: подготовка завершена, stageне запускали.
Rootпопросилвыйтиизкомнаты; fresh22:43:43UTC фактически0/0/0, затемguardedswap.
До/послеустановки0rooms/participants/tracks, никогонеотключали.281public,
8соседнихслужб,env/mount/security/limits/config/profiles/dataсохранены.
Maintenanceснят,0restarts; rollback99/image7ca сохранён. Миграций/cleanup/pushнет.
Receipt /workspace/castlink-caster-window-orange-final-receipt.json SHA256
`46e781226bc5f2a53c8ededb4e0c9da179a2d65515dac43dd233ca6ab710a6d6`.
Windows scope C:/Users/Max/Projects/studiolink-ha-ops/caster-window-orange-20261108/.
План docs/superpowers/plans/2026-11-08-caster-window-orange.md.
UI/ops — GPT-6.1 Sol high; orange/интеграция/проверки — rootCodex;
независимыйreview — GPT-6.1 Sol high console_a_review. Задача завершена.

## Предыдущая установка: прямой URL и компактные меню — 08.11.2026

castlink.ru: `1.0.0-rc.9-99f89126755e`, source
`99f89126755e057a4a218b7040677f840e2669fe`, tree
`bef7063eb88907c542f6719c6ef5ddf17a91cd9f`. Переключено21:50:51UTC.
Image: `sha256:7ca554c2d07868f636fbac2438bada5249483ca959d94595eba34dbfc01835f4`.

Добавлена прямая кнопка индивидуальногоURL справа от аудиометра гостя с
подтверждением копирования; используется прежний onCopy/copied. Меню устройств,
приглашений, комнаты и гостя уплотнены и открываются возле своих кнопок.
Расширенные группы раскрываются без пересоздания контроллеров; высота ограничена
доступным экраном, заголовок/закрытие закреплены. Вложенный toggle не меняет
состояние родительского меню; фокус возвращается корректно, включая Edit/Cancel.
У ON AIR удалён только декоративный символ перед надписью. Утверждённая А,
stats/codecs, mobilecaster8, handlers/permissions/busy/feedback и media owners
сохранены. Действие пользователя при обновлении: обновить вкладку браузера.

TSC,343officialstableCI, manualmap1856, профильные unit/browser — PASS.
Первичная матрица23контекста; финальные меню8контекстов плюс строгий320dark
focus-proof после queuednativeToggleEvent — PASS; немедленный BODY до toggle
не является потерей фокуса. Folded/expanded bounds иclose, реальные формы,
копирование/success, resize, nativefocus и mediaidentity проверены.
Локальные тестовые потоки; liveSFU/RemotePC сеансы не запускались.
Доказательства /workspace/studio-console-menus-confirmed и focus-proof.
Independent GPT-6.1 Sol high review закрыто без открытых замечаний.

Official whole-image build +Windows/VPS smoke +41compiled features и7точных
JS/CSSхешей через публичныйHTTPS — PASS. Root отдельно подтвердил /api/version.
До/после0rooms/participants/tracks;281public,8соседних служб,env/mounts/security/
limits/config/profiles/data сохранены; maintenance снят,0restarts. Rollback78db/
image08bacedb сохранён. Миграций/очистки/публичногоGitHubpush не было.
Receipt /workspace/castlink-studio-console-menus-final-receipt.json SHA256
`d0e959f29528dc6b53bf40a148cf7689b38ba5afc14734c1cd05bc06779ace3f`.
Windows scope C:/Users/Max/Projects/studiolink-ha-ops/studio-console-menus-20261108/.
План docs/superpowers/plans/2026-11-08-studio-console-menus.md.
UI/ops — GPT-6.1 Sol high; интеграция/проверки — root Codex;
независимый reviewer — GPT-6.1 Sol high console_a_review. Задача завершена.

## Предыдущая установка выбранной консоли А — 08.11.2026

castlink.ru: `1.0.0-rc.9-78dbf4b702d1`, source
`78dbf4b702d1dca4eadb8019956991911b504c0c`, tree
`c1ae2fad98b58e9a2fe37e8e8d2fbdf99637b083`. Переключено20:03:14UTC.
Image: `sha256:08bacedbd7f401d9faa462fdeef6747344bb79f02b1c496a1e721d15dde64a35`.
Задача завершена; открытых замечаний по согласованной А нет.

Программа16:10 слева с вертикальным аудиометром справа от картинки; ON AIR/звук
и компактные действия ниже. Карточки источников рядом,3колонки на обычном ПК;
принятая статистика/кодеки справа. Устройства, приглашения/доступы и расширенные
действия гостей доступны через native popover. Pending/errors остаются видны,
media/controller owners и реальные handlers/gates сохранены. Мобильный кастер
остаётся на согласованной8-кнопочной панели. Для загрузки версии обновить вкладку.

Доказательства:15 Chromium cases +3normal-height confirmations +Participants
RED→GREEN/defaultmic16px, TSC,343 stable CI tests, manualmap1854files — PASS.
Actual footer, fullrect селекторов, fivepictures на1280×540/560/600 и popupresize
с сохранением focus/media проверены. Изображения /workspace/studio-console-a-final/
и /workspace/studio-console-a-tall-confirm/. Превью используют локальные тестовые
потоки; liveSFU/RemotePC сеансы в этой задаче не запускались.

Официальный whole-image build, Windows/VPS isolated smoke,31compiled markers
и6 точных JS/CSS хешей через публичный HTTPS — PASS. Root отдельно подтвердил
public /api/version новым запросом. До/после0rooms/participants/tracks.281public,
8соседних служб, env/mounts/security/limits/config/profiles/data сохранены;
maintenance снят,0restarts. Rollback875/be85 сохранён. Ни миграций, ни очистки.

Receipt: /workspace/castlink-studio-console-a-final-receipt.json, SHA256
`8fd383a7df14755b65bf0da6869f1d3053ffb3f39277547d1a2506e541332891`.
Windows scope: C:/Users/Max/Projects/studiolink-ha-ops/studio-console-a-20261108/.
Spec/план: docs/superpowers/{specs,plans}/2026-11-08-studio-console-a*.md.
Frontend/ops: GPT-6.1 Sol high; GuestCard/AudioMeter/locales/интеграция: root Codex;
независимое ревью: GPT-6.1 Sol high console_a_review, закрыто без замечаний.

## Левая группа playback и настроек — установлено08.11.2026

Предыдущая web-версия castlink.ru: `1.0.0-rc.9-8750294fcab1`, source
`8750294fcab1c618e215c29072aec6b840a156b6`, tree
`85f039813041f35feedf85807de32dd1c49df444`. Установлено18:15:23UTC.

Окно16:10 закреплено слева в компактной общей карточке; короткий аудиометр
совпадает с шириной кадра. Управление и раскрываемые устройства рядом, приглашения
ниже, измеренная статистика и4 quality selectors в соседней панели.
Прокручивается только список устройств, transport и видео остаются видимыми.
Карточка/заголовок до800px, монитор до360px; график190px без растягивания текста.
Desktop compact с1101×701; меньшие/низкие окна используют поток без наложения Sources.

14 Chromium cases/0errors (включая1280×720zero/photo,1024×700,651fallback),
5 профильных suites, TypeScript, manual-docs1849 и diff--check PASS.
Независимое GPT-6.1 Sol high final_review — без блокирующих замечаний.
Official Docker build, isolated Windows/VPS smoke и26 compiled UI markers PASS.
Проверены26 признаков и точные хеши4 JS/CSS через публичный HTTPS;
root отдельно подтвердил buildId через curl. Mobile JS/CSS побайтово сохранены.

До/после0медиакомнат/участников/треков. Заменена только web-служба;
281static,8 соседних служб, env/mounts/config/profiles и данные сохранены.
Maintenance снят,629image доступен для отката. Владелец отдельно разрешил
точный875 patch transfer/build/install после отказа автоматической проверки.
Постоянные source/image/proofs:
C:/Users/Max/Projects/studiolink-ha-ops/studio-left-monitor-20261108/.
Квитанция: /workspace/castlink-studio-left-monitor-final-receipt.json;
проверки: /workspace/castlink-studio-left-monitor-validation.json.
Реальные browser-снимки продуктовых компонентов с тестовыми потоками:
/workspace/studio-grouped-preview/. Физический SFU/устройства не воспроизводились.
Root Codex — интеграция/проверки; GPT-6.1 Sol high mobile_ui — UI,
final_review — ревью, production_ops — сборка/установка. GitHub/установщики не менялись.
Открытая страница студии загрузит интерфейс после reload вне эфира.


## Мобильная панель без прокрутки — установлено 08.11.2026

Предыдущая web-версия castlink.ru: `1.0.0-rc.9-6294852b1d7b`, source
`6294852b1d7b3129ae376bfaab7340d007182f3f`, tree
`6f0242a568303585b40bee9e8c0a20292a53d884`. Установлено14:59:41UTC.

По уточнениям владельца в основном ряду остались микрофон, камера, чат без подписи,
реакции, демонстрация, системные настройки, «Ещё» и выход. В «Ещё» только загрузка
и фон/размытие камеры. Ряд без scroll/переноса; равные responsive кнопки35/40/44px
шириной на320/360/393px телефонах и44px высотой. Desktop сохраняет прямые действия.
Триггеры перенесены порталами; медиа, file input, prepared viewer и активные
контроллеры/Stop не прячутся в «Ещё» и сохраняются при resize.

Проверки:264 browser assertions/8 scenarios,16 hydrated interaction cases,
11 профильных suites, TypeScript и manual-docs PASS; независимое review
GPT-6.1 Sol high — без блокирующих замечаний. Official Docker build и isolated
Windows/VPS smoke PASS;13 compiled UI features и4 JS/CSS HTTPS hashes совпали.
Root независимо подтвердил публичный buildId через curl.

Web-only транзакция7секунд: до/после0 медиакомнат/участников/треков;
281static, конфигурация, mounts, профили, данные и8 соседних служб сохранены.
Maintenance снят, d2a909c image сохранён для отката. Материалы source/image/receipts:
C:/Users/Max/Projects/studiolink-ha-ops/caster-primary-actions-20261108/.
Квитанция: /workspace/castlink-caster-primary-actions-final-receipt.json.
Проверки: /workspace/castlink-caster-primary-actions-validation.json.
Скриншоты: /workspace/caster-more-final/ (локальные тестовые потоки, не физический POCO).
Дизайн/ограничения проверок: docs/design/CASTER_MOBILE_ACTIONS_20261108_RU.md.
Root Codex — интеграция/проверки; GPT-6.1 Sol high mobile_ui — UI,
final_review — ревью, production_ops — сборка/установка. Открытые страницы
получат правки после reload вне эфира. Публичные GitHub/установщики не обновлялись.


## Дополнительное обновление интерфейса — 08.11.2026

Установлено 14:26:29 UTC на https://castlink.ru: `1.0.0-rc.9-d2a909cce97c`,
source `d2a909cce97cd264d218e7e30f43daa3521f5ba9`, tree
`acf663ab7ead3bcda1e51d896c9d4ad4ffe8df79`.

По фотографиям владельца исправлены два пропуска прежней проверки:
мобильные действия теперь в одном горизонтальном ряду с локальной прокруткой
и кнопками44×44; недоступная демонстрация не создаёт вертикальную колонку текста.
Окно STUDIO PLAYBACK16:10, исходное видео пропорционально содержится внутри.
Компактная студия, карточки источников, статистика и настройки сохранены.

342 stable CI tests, TypeScript,11 студийных browser-сценариев,240 мобильных
проверок и toolbar suites12/16 PASS; независимое review GPT-6.1 Sol high —
без блокирующих замечаний. Official Docker build, isolated Windows/VPS smoke,
точное совпадение281static и трёх compiled UI assets через HTTPS — PASS.
Root независимо подтвердил публичный buildId через curl.

Web-only транзакция7секунд, до/после0 медиакомнат/участников/треков;
конфигурация, mounts, профили, данные и8 соседних служб сохранены.
Maintenance снят, предыдущий ce82 image сохранён для отката.
Постоянные source.bundle/image/receipts:
C:/Users/Max/Projects/studiolink-ha-ops/studio-toolbar-aspect-20261108/.
Санитизированная квитанция: /workspace/castlink-toolbar-aspect-final-receipt.json;
проверки UI: /workspace/castlink-toolbar-aspect-validation.json.
User отдельно подтвердил передачу точного патча на свой Windows build host,
сборку и установку после отказа автоматической проверки разрешений.

Реализация: root Codex — playback/интеграция; GPT-6.1 Sol high mobile_ui —
мобильная панель, final_review — независимое ревью, production_ops — сборка/установка.
Скриншоты сделаны с локальными тестовыми потоками; физический POCO не воспроизводился.
Открытые страницы загрузят правки после reload вне эфира.


## Фактическая установка — 08.11.2026

Установлено 12:52:58 UTC на https://castlink.ru: `1.0.0-rc.9-ce82c0befdd1`,
source `ce82c0befdd14a4b2666355fdadba3a30123da39`, tree
`ba7b3c98a01505899bbf93c23e8b4ce7c2f1ca17`. Транзакция заняла 7 секунд,
до/после: 0 медиакомнат, участников и треков. Заменена только web-служба.
Конфигурация, mounts/лимиты, профили, данные, 281 публичный файл и восемь соседних
служб сохранены. Maintenance снят, предыдущий 128aac image сохранён для отката.

342 stable CI tests — EXIT0; TypeScript, Docker build, isolated smoke,
9 studio browser сценариев, 120 мобильных проверок и native Chromium audio PASS.
Проверка публичных HTTPS-маршрутов и точных хешей новых JS/CSS PASS; независимый
root curl повторно подтвердил buildId. Восстановленная диагностика/reconnect
сохранены. Неподтверждённый браузером DSP показывает ошибку, сохраняя выбранное
пользователем состояние микрофона; физический POCO ещё не проверен.

Санитизированная квитанция: /workspace/castlink-final-deploy-receipt.json,
SHA256 `23656e217fdf5faa0a0f967285c94a5796cd50e2b63583a0c1f319430019f65c`. Постоянный source.bundle, source.tar, image и квитанции:
C:/Users/Max/Projects/studiolink-ha-ops/today-ui-20261108-v2/.
Bundle SHA256 `e7caf8662c9b2594f5fd058d1bf8e0b467625bf05215c3e2c1b7dbc46d85c375`.
GitHub push/публичные релизы, установщики и другие серверы не изменялись.
После обновления страницы студии/кастера следует перезагрузить вне эфира;
сохранённый raw не переключается скрыто, обработку можно включить вручную.


## Историческая запись — 02.11.2026

Задача владельца: убрать обновление большой студии ради шкал громкости, добавить диагностические сведения основной студии в общую веб-часть клиента и серверных продуктов; сначала установить на Timeweb.

База: public main48478006e4348f1e185fb8066ee6233481a8a6a2. Старый checkout приватного studiolink не использовался для сборки. Все44файла текущего Timeweb incident hotfix побайтово совпали с этой базой. Все281файл hosted static сняты и сверены оператором перед сборкой. Серверная конфигурация/данные не входят в кодовый патч.

Готово: устранён obsolete RAF setGuests, сохранено обновление статистики/мута/имени/SID/микрофонного track; добавлены runtime сборщик без React state, schema/sanitizer, существующий authenticated stats ingestion, room-scoped и platform node история, JSON экспорт с лимитами и локальные current/previous snapshots. Инструкция: distribution/STUDIO_DIAGNOSTICS.md (RU/EN/zh).

Проверки до установки: focused suites API/tenant/archive/relay/export/renewal/audio/roster PASS; web TypeScript PASS; production Next build PASS. Реальный Chromium: искусственная задержка1260мс зарегистрирована, errors/rejections учтены без текста ошибки, previous snapshot сохранён после actual reload. Полный CI запускается и его итог фиксируется перед доставкой. Блокирующих замечаний независимого ревью нет.

Исполнители GPT-6.1 Sol high: studio_render — roster/lifecycle, runtime_backend — schema/API/history/relay, runtime_ui — Statistics/export/i18n, timeweb_ops — read-only audit/build/deploy. Основной Codex — collector/integration/browser verification; review_studio (GPT-6.1 Sol high) — независимое ревью. Общие файлы распределены без параллельного редактирования одного исходника.

Ограничения: физические устройства и исходный orange-screen инцидент не воспроизведены; WebRTC/GPU/renderer crash не диагностируется окончательно по одному пропуску замеров. Новый код в общей веб-части применяется к клиентам обновлённого сервера после reload. Самостоятельные Windows/Linux серверы требуют поставки обновлённых пакетов; прежние релизы и checksums не заменяются. Публичные установщики автоматически не публикуются.

Следующий шаг: завершить CI, создать exact source commit, build на Windows с текущим hosted overlay, recheck zero sessions, guarded web-only deployment и HTTPS verification. Итог фактической доставки будет дополнен отдельно.
