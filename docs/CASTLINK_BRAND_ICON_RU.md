# Единая иконка CastLink

13.10.2026. Эталон владельца: скруглённый квадрат mint/sage, градиент от `#9DD6C1` к `#658B7B`, белая C. Остальная графитовая палитра сохранена. Белая буква — векторный контур, её вид не зависит от установленных шрифтов.

Канонический источник — `assets/brand/castlink-icon.svg`. После `pnpm install` команда `node scripts/build-brand-icons.mjs` обновляет SVG приложения и landing, Apple PNG 180px и одинаковые ICO для браузера/Windows с размерами 16/24/32/48/64/128/256. ICO использует BGRA DIB с альфой и AND mask для совместимости с Framework WPF/csc. Производные файлы входят в Git; при обычной упаковке отдельная генерация не нужна.

Приложение использует `BrandIcon` и стандартные файлы Next `app/icon.svg`, `favicon.ico`, `apple-icon.png`; они не требуют копирования `public/` в standalone. Landing использует тот же SVG по `/general/favicon.svg` в шапке, схеме и подвале. Версии URL и CSS обновлены. Установщик и панель используют самый большой кадр того же ICO для логотипа/Window.Icon; существующие desktop/tray пути сохранены. `csc /win32icon` встраивает ICO в `EasySetup.exe`.

Проверено локально: 3 Node tests (канонические assets/SSR и фактическая упаковка Windows ZIP с SHA256 и 7 кадрами); 3 существующих entry/guest-media fixtures; независимый Pillow decode всех 7 ICO размеров и прозрачных углов; XML parse обоих WPF окон; `git diff --check`. Chromium: 15 вариантов landing RU/EN/中文 и SSR компонента с настоящими CSS dark/light, ширины 320/390/1440, загрузка SVG, отсутствие перекрашивания/overflow/page errors. Артефакты текущей сессии: `/tmp/castlink-brand-browser.json`, `/tmp/castlink-brand-{landing,web}-{320,390,1440}.png`.

Native Windows run38440774684 SUCCESS: csc WinExe, извлечённая иконка EXE, 256px источник в мастере/панели и Window.Icon; GUI/graphite/control fixtures PASS. Лог проверен через GitHub Actions. Артефакт загружен workflow; скачивание в облачную среду получило403. Next production build и реальные metadata routes этим этапом не проверены. Production/public release не менялись.
