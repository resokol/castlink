# Основная студия: производительность и диагностика — 02.11.2026

Задача владельца: убрать обновление большой студии ради шкал громкости, добавить диагностические сведения основной студии в общую веб-часть клиента и серверных продуктов; сначала установить на Timeweb.

База: public main48478006e4348f1e185fb8066ee6233481a8a6a2. Старый checkout приватного studiolink не использовался для сборки. Все44файла текущего Timeweb incident hotfix побайтово совпали с этой базой. Все281файл hosted static сняты и сверены оператором перед сборкой. Серверная конфигурация/данные не входят в кодовый патч.

Готово: устранён obsolete RAF setGuests, сохранено обновление статистики/мута/имени/SID/микрофонного track; добавлены runtime сборщик без React state, schema/sanitizer, существующий authenticated stats ingestion, room-scoped и platform node история, JSON экспорт с лимитами и локальные current/previous snapshots. Инструкция: distribution/STUDIO_DIAGNOSTICS.md (RU/EN/zh).

Проверки до установки: focused suites API/tenant/archive/relay/export/renewal/audio/roster PASS; web TypeScript PASS; production Next build PASS. Реальный Chromium: искусственная задержка1260мс зарегистрирована, errors/rejections учтены без текста ошибки, previous snapshot сохранён после actual reload. Полный CI запускается и его итог фиксируется перед доставкой. Блокирующих замечаний независимого ревью нет.

Исполнители GPT-6.1 Sol high: studio_render — roster/lifecycle, runtime_backend — schema/API/history/relay, runtime_ui — Statistics/export/i18n, timeweb_ops — read-only audit/build/deploy. Основной Codex — collector/integration/browser verification; review_studio (GPT-6.1 Sol high) — независимое ревью. Общие файлы распределены без параллельного редактирования одного исходника.

Ограничения: физические устройства и исходный orange-screen инцидент не воспроизведены; WebRTC/GPU/renderer crash не диагностируется окончательно по одному пропуску замеров. Новый код в общей веб-части применяется к клиентам обновлённого сервера после reload. Самостоятельные Windows/Linux серверы требуют поставки обновлённых пакетов; прежние релизы и checksums не заменяются. Публичные установщики автоматически не публикуются.

Следующий шаг: завершить CI, создать exact source commit, build на Windows с текущим hosted overlay, recheck zero sessions, guarded web-only deployment и HTTPS verification. Итог фактической доставки будет дополнен отдельно.
