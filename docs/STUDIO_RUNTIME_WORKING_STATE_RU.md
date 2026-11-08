# Основная студия: рабочее состояние — 08.11.2026

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
