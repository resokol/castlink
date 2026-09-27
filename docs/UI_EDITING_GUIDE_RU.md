# CastLink: где найти и как править элементы интерфейса

Практическая карта для ручных правок в VS Code. Сверена с исходниками 27.09.2026 после выпуска **0.9.23-panel-fixes**. Описывает текущий код в рабочей папке; незакоммиченные изменения могут отсутствовать на GitHub.

## 1. С чего начать

Откройте проект и этот гайд:

```bash
cd ~/studiolink
code studiolink.code-workspace
```

В VS Code: **Ctrl+P** — открыть файл, **Ctrl+F** — найти внутри файла, **Ctrl+Shift+F** — найти во всём проекте, **Ctrl+Shift+V** — открыть удобный просмотр этого Markdown, **Ctrl+S** — сохранить.

В таблицах ниже пути начинаются от **`apps/web/`**. Например, `components/MediaDevicePicker.tsx` означает `apps/web/components/MediaDevicePicker.tsx`. Столбец «Искать» содержит точную строку или имя в коде. Используйте его вместо номера строки: номера меняются после каждой правки.

| Что хотите изменить | Где менять |
| --- | --- |
| Текст кнопки, заголовок, подсказку | `.tsx`: текст между тегами, `placeholder`, `title`, `aria-label` |
| Расстояние, ширину, цвет, размер, колонки | `.css`: правило для `className` элемента |
| Порядок блоков | JSX внутри `return (...)` страницы; иногда положение переопределено CSS |
| Действие кнопки | Обработчик `onClick`, `onChange` или `onSubmit` |
| Доступность/состояние кнопки | `disabled`, `aria-pressed`, условие отображения и соответствующий state |
| Допустимый диапазон, права доступа, сохранение на сервере | Клиентский обработчик **и** серверный API; одной правки подписи/списка недостаточно |

**Простой способ работы:** найдите видимую надпись → найдите окружающий элемент → посмотрите его `className` и обработчик → измените только необходимое → проверьте результат.

## 2. Карта страниц и общих файлов

| Адрес / область | Основной файл | Что важно |
| --- | --- | --- |
| `/` и `/room` — вход гостя и комната | [app/room/page.tsx](../apps/web/app/room/page.tsx) | `app/page.tsx` повторно экспортирует гостевую страницу. Правка комнаты затронет оба адреса |
| `/studio` — основная студия | [app/studio/page.tsx](../apps/web/app/studio/page.tsx) | Здесь рабочая панель и подключение экранов входа |
| `/admin` | [components/RoomControlConsole.tsx](../apps/web/components/RoomControlConsole.tsx) | `app/admin/page.tsx` только передаёт `accessMode="admin"` |
| `/moderator` | Тот же `RoomControlConsole.tsx` | `app/moderator/page.tsx` передаёт `accessMode="moderator"`; флаг `limited` ограничивает элементы |
| `/watch?room=...` — зрительская ссылка | [app/watch/page.tsx](../apps/web/app/watch/page.tsx) | Звук и видео только студии; зритель не публикует устройства |
| `/output/[identity]` — отдельный выход | [app/output/[identity]/page.tsx](../apps/web/app/output/%5Bidentity%5D/page.tsx) | Чистый выход для режиссёрского ПО; служебные кнопки сюда не добавлять |
| `/monitor` | [app/monitor/page.tsx](../apps/web/app/monitor/page.tsx) | Отдельная страница мониторинга |
| `/transfer` | [app/transfer/page.tsx](../apps/web/app/transfer/page.tsx) | Статус перехода между серверами |
| Общие стили | [app/globals.css](../apps/web/app/globals.css) | Кнопки, темы, панели, раскладка, мобильные правила |
| Название вкладки браузера | [app/layout.tsx](../apps/web/app/layout.tsx) | `metadata`, `title: "CastLink"`; здесь подключаются глобальные стили и `AppUpdateNotice` |
| Экраны входа студии/панелей | [components/StudioEntry.module.css](../apps/web/components/StudioEntry.module.css) | Локальные CSS-классы вида `styles.entryCard` |

**Общие компоненты:** изменение `MediaDevicePicker`, `MonitoringControls`, `RoomControlConsole` или общего CSS может изменить несколько экранов сразу. Для правки только одной страницы ограничьте CSS её классом, например `.studio-page ...`.

## 3. Студия: блоки, кнопки, подписи

Все строки этой таблицы — в **`app/studio/page.tsx`**, кроме отдельно указанных компонентов.

| Элемент на экране | Искать в файле | За что отвечает / что править |
| --- | --- | --- |
| Левый логотип CastLink, LIVE PRODUCTION | `studio-brand` | Текст, буква логотипа, оформление — `.studio-brand`, `.studio-brand-mark` |
| Вкладки «Студия», «Участники и гости», «Статистика и графики» | `aria-label="Раздел студии"` | `setActiveTab(...)` выбирает вкладку; подпись кнопки можно менять, внутренние значения `studio/participants/statistics` сохранять |
| «Выйти из студии» | `Выйти из студии` | DELETE `/api/auth` и перезагрузка. Это выход из учётной записи панели |
| Активная комната и статус слева | `sidebar-room-card` | Показывает `roomName` и `status`; это данные, а не постоянные подписи |
| Название комнаты сверху | `<h1>{roomName}</h1>` | Заголовок получает имя комнаты; размер — CSS, переименование самой комнаты — через меню |
| Кнопка-бургер «Комната» | `studio-room-menu-toggle` | `setRoomMenuOpen(...)`; открывает блок `studio-room-management-panel` |
| Выбор комнаты | `aria-label="Активная комната"` | `switchRoom`; меняет подключение к комнате |
| Новая комната и её пароль | `Название новой комнаты` | Поля `newRoomName`, `newRoomPassword`; `createRoom` отправляет запрос серверу |
| «Изменить» и «Удалить комнату» | `openRoomEditor`, `deleteRoom` | Первое открывает редактор, второе удаляет комнату через API |
| Окно изменения имени/пароля | `room-edit-dialog` | `saveRoomSettings`, `editRoomPassword`, `showEditRoomPassword`; CSS `.room-edit-backdrop`, `.room-edit-dialog`, `.password-field` |
| Блок «Приглашения и доступы» | `studio-invite-access` | Вставляет компоненты ссылок; расположение — `.studio-invite-grid` |
| Монитор Studio Return и индикатор эфира | `aria-label="Studio Return monitor"` | Блок `.studio-return-hero`, карточка `.studio-return-preview-card`, видео `.return-preview`, индикатор `.air-state`, `.air-dot` |
| «Исходящий поток студии», измеренные значения | `Исходящий поток студии` | `.return-stats`, `.return-stat-grid`; данные `displayedOutbound`. Не заменять их выбранным лимитом |
| График видеобитрейта | `returnBitratePoints` и `bitrate-chart` | История `displayedHistory`; SVG, подписи шкалы и CSS `.bitrate-chart-*` |
| Частота кадров и общий битрейт | `return-output-controls` | `changeQuality(...)`; варианты из `lib/video-quality.ts` |
| Сообщения об ошибке управления | `studioControlError` | Сам текст ошибки может приходить из API; оформление `.studio-control-error` |
| Камера, микрофон, наушники | `<MediaDevicePicker` | Подключение общего компонента; контейнер `.studio-device-panel` |
| «Гости могут видеть только студию» | Этот текст | Переключает `studioOnly` через POST `/api/rooms`, action `mode`. Это режим комнаты, не личное отключение видео |
| «Проверить Studio Return» / «Остановить проверку» | `changePreview(!returnActive)` | Управляет предпросмотром. Сохраняйте условие `disabled` во время эфира |
| ON AIR / OFF AIR — кнопка | `requestOnAir(!onAir)` | Управляет публикацией. Красный активный стиль `.air-toggle-live`; не путать с индикатором в заголовке |
| Усиление звука студии | `changeGain` | Эфирная громкость, в отличие от личного мониторинга; индикаторы `.return-audio-meter`, `.db-meter` |
| «Мой Studio Return — мониторинг» | Этот текст | `MonitoringControls`, `returnMonitor`; меняет только личный предпросмотр |
| Карточки видео гостей | `aria-label="Видео гостей"` | `.studio-video-wall`, `.studio-video-card`; функция `GuestPreview` подключает трек |
| «Открыть», «Копировать URL», «Скопировано» под гостем | `guest-preview-actions` | `outputUrl(g.identity)`, clipboard и `setCopied`; такие кнопки есть также в таблице участников |
| Отдельный список персонала | `studio-staff-panel` | Имена/роли из `staffParticipants`; цвета `.studio-participant-role-admin/moderator/guest` |
| Таблица гостей | `guest-table` | Заголовки `<th>`, значения `<td>`; при перестановке колонки переносить заголовок и соответствующие ячейки |
| «Перевести», «Отключить гостя», «↻ Обновить» | `studio-guest-actions` | `/api/move-guest`, `kick`, пересоздание личных подписок соответственно |
| Входящий лимит в таблице | `applyReceiveQuality` | Выбирает качество приёма гостя этой панелью; не равен исходящему лимиту студии |
| Перенос комнаты на сервер | `aria-label="Серверы переноса комнаты"` | `.transfer-compact`, `startServerTransfer`, `transferTargetId`; «Обновить список» — `setTransferRefresh` |

### Схема блоков студии

Это порядок крупных блоков JSX, полезный для поиска места переноса:

```text
main.studio-app-shell
├─ aside.studio-sidebar — навигация
└─ div.studio-main-column
   ├─ studio-header — название и кнопка «Комната»
   ├─ studio-room-management — раскрываемое меню комнаты
   ├─ studio-video-section → studio-return-hero
   │  ├─ studio-return-preview-card — монитор
   │  └─ return-stats — статистика, график, FPS/битрейт
   ├─ уведомление переноса / условный диалог редактирования
   ├─ studio-settings
   │  ├─ studio-device-panel — устройства и гостевой инвайт
   │  └─ return-panel — проверка, эфир, режим комнаты, мониторинг
   ├─ studio-video-section → studio-video-wall — видео гостей
   ├─ StatisticsDashboard — только на вкладке статистики
   ├─ studio-participants-section — персонал и таблица гостей
   └─ transfer-compact — перенос сервера, только основная студия
```

У скрываемых секций есть `hidden={...}`. Переносите секцию **целиком с этим условием**, иначе она появится на всех вкладках. Служебный `RoomAudioRenderer` воспроизводит звук, хотя видимого блока у него нет: не удаляйте его как «пустой».

## 4. Администратор и модератор

Основной файл — **`components/RoomControlConsole.tsx`**. В конце файла есть **`<style jsx>`**: часть оформления задаётся здесь, а не в `globals.css`.

| Элемент | Искать | Что делает |
| --- | --- | --- |
| Экран проверки ссылки и ошибки входа | `Проверяем приглашение`, `retryInvite` | Проверяет отдельный доступ, предлагает повторить принятие |
| Название панели | `Панель модератора`, `Администратор` | Зависит от `limited`; не менять логику ролей ради подписи |
| Вкладки | `setActiveTab` | Статистика доступна при `!limited` |
| Меню комнаты | `roomMenuOpen` | Раскрывает настройки и доступные приглашения |
| Кнопка режима «только студия» сверху | `room-mode-toggle` | Общий режим комнаты; оформление `.control-quick-actions` |
| Монитор и правый блок | `admin-return-hero`, `moderator-return-hero` | Общие классы Studio Return плюс различия по роли |
| График и измерения | `Исходящий поток основной студии` | `sample`, `history`, `points`; для модератора скрыты |
| FPS, битрейт, усиление, ON AIR | `const command` | POST `/api/studio-control`; меняет настройки основной студии, не захватывает её устройства |
| «Слушать студию», «Не слушать студию», личная громкость | `mainPreference.audio` | `monitor.change(...)`; действует только в этой панели |
| Видео гостей/персонала | `ParticipantPreview`, `control-participant-card` | Личный просмотр треков; размеры `.control-participant-preview` |
| Включить/выключить микрофон или камеру гостя | `const guestAction`, `"media"` | Общее действие над гостем; включение зависит от разрешений на его устройстве |
| «Удалить модератора», «Отключить гостя» | `guestAction`, `"kick"` | Серверное отключение участника |
| Перевести гостя | `guestAction`, `"move"` | Показывается при подходящей области модераторского доступа |
| Создание/переименование комнат | `ModeratorRoomTools` | Реализация в `components/ModeratorRoomTools.tsx`; ищите `Создать комнату`, `Переименовать` |
| Говорить комнате/лично, камера панели, выход звука | `TalkbackControls` | Реализация в `components/TalkbackControls.tsx`: `start`, `stop`, `changeTarget`, `toggleCamera`, `setPanelCamera`; выход — `AudioOutputSelect.tsx` |

`limited` и `accessMode` — не косметические переключатели. Не удаляйте условия `!limited` для «возврата кнопки» модератору: изменение прав требует согласованного изменения сервера и тестов. В студийном коде историческое `studioRole === "moderator"` обозначает дополнительную панель администратора; не заменяйте его автоматически на основании видимой надписи.

## 5. Гость: вход, устройства, комната

| Экран / элемент | Файл | Искать / действие |
| --- | --- | --- |
| Выбор сервера гостем | `components/GuestServerPicker.tsx` | Стили рядом: `GuestServerPicker.module.css`; список сохранённых адресов — также `lib/saved-servers.ts` |
| Название комнаты, пароль, «Войти» | `components/GuestAccessGate.tsx` | `Вход в комнату`, обработчик формы; сервер проверяет пароль в `/api/auth` |
| «Как вас представить в эфире?», поле имени, «Продолжить» | `app/room/page.tsx` | `confirmedName`, `setConfirmedName`, `.guest-name-card` |
| Проверка до входа | `components/GuestAvCheck.tsx` | `.guest-av-page`, `.av-check`, `.av-preview` |
| «Войти без камеры», «Войти без микрофона» | `components/GuestAvCheck.tsx` | `choices.videoEnabled`, `choices.audioEnabled`, `change(...)`; без микрофона не означает без входящего звука |
| «Проверить устройства», «Войти в конференцию» | `components/GuestAvCheck.tsx` | `check(false)` проверяет, `check(true)` проверяет и вызывает `onJoin` |
| Три списка устройств | `components/MediaDevicePicker.tsx` | Подписи `Камера`, `Микрофон`, `Наушники`; `refresh`, `onChange`, `.media-device-picker` |
| Боковая панель и список людей | `app/room/page.tsx` | `.guest-sidebar`, `.guest-participant-list`, `remoteList` |
| Видео участников | `app/room/page.tsx` | `GuestConference`, `GridLayout`, `FocusLayout`, `CarouselLayout`, `ParticipantTile` |
| Встроенные кнопки камеры/микрофона/чата/экрана | `app/room/page.tsx` | `<ControlBar controls=...>` — компонент LiveKit, а не набор собственных `<button>` |
| «Включить звук от студии» | `app/room/page.tsx` | `<StartAudio label=...>` — разрешение воспроизведения в браузере |
| «Выйти из комнаты» | `app/room/page.tsx` | `onLeave`, `room.disconnect()` |
| Шестерёнка настроек | `app/room/page.tsx` | `guest-hover-settings`, `setSettingsOpen` |
| Громкость микрофона в комнате | `app/room/page.tsx` | `.audio-gain-row`, `choices.micGain` |
| «Мониторинг у меня», «Я · самопрослушивание…» | `app/room/page.tsx` | `selfMonitor`, `monitoring.change`; общие кнопки в `MonitoringControls.tsx` |

Названия и устройство кнопок LiveKit ищите сначала в месте подключения `ControlBar`. Не редактируйте `node_modules`: изменения исчезнут после установки зависимостей. Для оформления используются `.lk-control-bar`, `.lk-participant-tile`, `.lk-grid-layout` внутри классов гостевой страницы.

## 6. Общие кнопки, ссылки, надписи

| Что видно | Файл | Искать / связь |
| --- | --- | --- |
| Вход студии по паролю | `components/AccessGate.tsx` | `Вход в студию`, форма, `/api/auth`; стили `StudioEntry.module.css` |
| Выбор сервера и комнаты студии | `components/StudioRoomPicker.tsx` | `Выберите сервер`, `Выберите комнату`, `Создать новую`; `connect`, `addServer`, `submitRoom` |
| Гостевой инвайт | `components/RoomInviteButton.tsx` | Запрос `/api/invites`; компонент используется на нескольких страницах |
| Приглашение администратора | `components/AdminInviteButton.tsx` | `/api/admin-access` |
| Приглашение модератора | `components/ModeratorInviteButton.tsx` | `/api/moderator-access`; сохраняйте область доступа |
| «Ссылка на поток студии» и пояснение о дополнительном потоке | `components/StudioStreamInviteButton.tsx` | `create`, `/api/studio-viewer`; это источник текста под ссылкой |
| «Звук вкл./выкл.», «Видео вкл./выкл.», личная громкость | `components/MonitoringControls.tsx` | `onChange({ audio/video/volume })`; оформление `.personal-monitor-controls` |
| «Кому говорить», «Говорить всем/приватно», «Завершить разговор» | `components/TalkbackControls.tsx` | `.talkback-controls`, `activeTarget`, `start`, `stop`; не убирать серверные ограничения подписки |
| Тёмная/светлая тема | `components/ThemeToggle.tsx` | `toggle`, `data-theme`; цвета в `globals.css` |
| Версия, сервер, «Проверить обновления», «Обновить приложение» | `components/AppUpdateNotice.tsx` | `check`, `checking`, `newVersion`; `.app-version-row`, `.app-update-banner` |
| Развёрнутая статистика | `components/StatisticsDashboard.tsx` | `.stats-summary`, `.stats-chart-grid`, `.stat-chart`, `.stats-table`; данные `/api/stats` |
| Заголовок «Поток студии» на `/watch` | `app/watch/page.tsx` | `.stream-watch-page`, `.stream-watch-monitor` |
| Кнопки звука/видео на `/watch` | `app/watch/page.tsx` | `toggleSound`, `toggleVideo`; `.stream-watch-controls` |
| Ошибки и «Повторить подключение» на `/watch` | `app/watch/page.tsx` | `status`, `failed`, `setAttempt` |

Если надписи нет в JSX, посмотрите, не приходит ли она из `data.error` ответа `/api/...`. Тогда искать её нужно и в `app/api`. Имя участника/комнаты приходит из данных: менять подпись JSX вместо этих данных не нужно.

## 7. Как менять расположение и размеры

### Какие CSS-свойства за что отвечают

| Свойство | Простое объяснение |
| --- | --- |
| `padding` | Отступ содержимого от края самого блока |
| `margin` | Расстояние снаружи блока |
| `gap` | Расстояние между элементами flex/grid |
| `grid-template-columns` | Ширина и количество колонок |
| `display: flex`, `flex-wrap: wrap` | Элементы в ряд с переносом |
| `display: grid` | Раскладка по сетке |
| `width`, `max-width`, `height`, `max-height` | Размер и ограничения размера |
| `min-width: 0` | Разрешает элементу сжиматься в колонке без распирания страницы |
| `aspect-ratio: 16 / 9` | Сохраняет пропорции видеоблока |
| `object-fit: contain` | Показывает весь кадр; `cover` заполняет блок, но может обрезать картинку |
| `overflow-y: auto` | Вертикальная прокрутка при ограниченной высоте |
| `@media (max-width: ...)` | Отдельные правила для узкого окна |

В `globals.css` есть **повторные правила** одних классов. При равной важности и специфичности побеждает более позднее правило. Более точный селектор может победить даже более поздний простой. Сначала найдите **все** совпадения, особенно мобильные. В `RoomControlConsole.tsx` учитывайте ещё `<style jsx>`, а в JSX — `style={{...}}`.

### Пример A: переименовать кнопку без смены действия

В `GuestAvCheck.tsx` найдите:

```tsx
{busy ? "Проверка…" : "Войти в конференцию"}
```

Замените только текст, например:

```tsx
{busy ? "Проверка…" : "Подключиться к комнате"}
```

Оставьте `onClick={() => void check(true)}` и `disabled={busy}`. Если у изменяемой кнопки есть `aria-label` или `title`, приведите их к тому же смыслу. Это полезно для подсказок и доступности.

### Пример B: монитор студии шире, статистика уже

В `globals.css` найдите `.studio-return-hero`. Для изменения только основной студии на широких экранах добавьте рядом с соответствующими правилами:

```css
@media (min-width: 901px) {
  .studio-page .studio-return-hero {
    grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  }
}
```

Это меняет соотношение двух колонок. Проверьте экран около901px и широкое окно. Если нужно такое же изменение в админке, там другой контейнер `.admin-room-page .admin-return-hero`. Не удаляйте существующее правило одной колонки на телефоне.

### Пример C: сделать меньше промежуток между кнопками эфира

Найдите текущее правило:

```css
.studio-page .studio-settings .return-buttons { gap: 6px; }
```

Поменяйте `6px`, например на `8px`. `gap` меняет расстояние, `padding` у кнопок — их внутренний размер. Для телефона есть отдельные правила с `min-height: 44px`; сохраняйте удобный размер нажатия.

### Пример D: перенести блок выше или ниже

В `studio/page.tsx` найдите целиком `<div className="panel return-panel">...</div>` внутри `studio-settings`. Вырежьте **весь блок с закрывающим тегом**, вставьте в нужное место среди соседних блоков. Для перестановки кнопки перенесите весь её `<button ...>...</button>`, сохранив обработчик и условия.

Если перемещаете блок из `studio-settings` наружу, стили `.studio-settings .return-panel` и другие родительские селекторы перестанут действовать. Проще сначала менять порядок **внутри прежнего родителя**. Не копируйте блок вместо переноса: два `<video ref={...}>` или два подключающих компонентa могут нарушить медиа. Не удаляйте `key={participant.identity}` при перестановке карточек.

### Пример E: изменить высоту просмотра у гостя

Найдите **все** `.guest-conference-grid` в `globals.css`. Есть несколько базовых и мобильных правил, а также более точный `.guest-room-page.guest-app-shell .guest-conference-grid`. Меняйте фактически применяемое правило, проверенное через F12 → Elements → Computed → height. `clamp(минимум, желаемый размер, максимум)` ограничивает высоту; `svh` — доля высоты окна.

Не задавайте всей странице `overflow: hidden`: это может убрать возможность долистать участников и настройки. Для числа гостевых карточек основной студии ищите `.studio-video-wall:not([hidden])`: сейчас есть отдельные сетки для широкого и узкого окна.

### Пример F: единый цвет кнопок

Ищите `--primary`, `--primary-hover`, `--media-accent` в `globals.css`. Есть определения для `:root` и `:root[data-theme="light"]`, включая поздние переопределения. Меняйте итоговые значения для обеих тем. Красные состояния ON AIR и цветные роли задаются отдельно: общей сменой основного цвета их менять не нужно.

## 8. Небольшие правки поведения: где остановиться

| Задача | Минимальная точка изменения | Что дополнительно проверить |
| --- | --- | --- |
| Дольше показывать «Скопировано» | `setTimeout(() => setCopied(undefined), 1200)` в studio/page.tsx | Есть два места: карточка и таблица. Например,1500 — полторы секунды; сама операция clipboard остаётся |
| Меню комнаты открыто при входе | Начальное значение state `roomMenuOpen` | Менять только инициализацию; при смене комнаты/страницы состояние может сбрасываться |
| Иная подпись при включённом состоянии | Условие `value.audio ? ... : ...` в MonitoringControls | Оба состояния и `aria-label`; это личный мониторинг |
| Скрыть чат или показ экрана у гостя | `ControlBar controls` и условие `<Chat>` в GuestConference | Это изменение UI, не запрет API/публикации для изменённого клиента |
| Поменять исходящий битрейт/FPS или default | `lib/video-quality.ts`, `lib/studio-control.ts`, оба интерфейса и обработчики | Сохранённое значение не заменяется автоматически. Проверить серверную валидацию, основной sender и /watch |
| Изменить кнопку действия над гостем | `guestAction` в RoomControlConsole и соответствующий API | Личное `monitor.change` и общий `guestAction` — разные операции |
| Изменить логику смены серверов | StudioRoomPicker/GuestServerPicker или startServerTransfer | Выбор сервера при входе и перенос всей текущей комнаты — разные сценарии |

Приватность и права доступа не обеспечиваются скрытием кнопки. Изменения `useEffect`, подключения/отключения треков, lease, подписок, авторизации и переноса серверов — уже не косметика. Для них нужна проверка поведения, а не только сборка. Особенно не удаляйте cleanup (`return () => ...`) у эффекта: это часто причина дублирования плиток или зависших устройств.

## 9. Проверка правки: команды и правильный результат

Все команды — из `~/studiolink`. Сначала сохраните отдельную копию **изменяемого файла**, потому что в репозитории уже есть незакоммиченные изменения. Для CSS, например:

```bash
cp -p apps/web/app/globals.css /tmp/castlink-globals-before-edit-$(date +%Y%m%d-%H%M%S).css
```

### Найти элемент из консоли

```bash
rg -n -F 'Гости могут видеть только студию' apps/web/app apps/web/components
rg -n -F 'studio-return-hero' apps/web/app/globals.css
```

Нормальный вывод: `путь:номер строки:фрагмент кода`. Если `rg` не установлен:

```bash
grep -RFn 'Гости могут видеть только студию' apps/web/app apps/web/components
grep -nF 'studio-return-hero' apps/web/app/globals.css
```

Пустой результат означает, что точной строки нет: ищите короткую часть текста или имя класса. В VS Code исключите `**/node_modules/**, **/.next*/**`, чтобы не попадать в сгенерированные копии.

### Проверить TypeScript и пробелы

```bash
pnpm --filter web exec tsc --noEmit
git diff --check
```

Успех: команды завершаются без ошибок, обычно без вывода. TypeScript-ошибка содержит файл и номер строки. `git diff --check` проверяет формат diff, а не работу кнопок. Новые untracked-файлы эта проверка не охватывает.

### Посмотреть интерфейс локально, не занимая рабочий порт3000

Для отдельного UI-предпросмотра используйте свободный порт, например3005, и отдельные файлы состояния:

```bash
ss -ltn 'sport = :3005'
```

Если видна только строка заголовков — слушателя нет. Если есть `LISTEN`, выберите другой свободный порт; не останавливайте чужой процесс.

```bash
NEXT_BUILD_DIR=.next-ui-edit \
STUDIOLINK_RELEASE=ui-edit-preview \
STUDIOLINK_ROOMS_FILE=/tmp/castlink-ui-edit-rooms.json \
STUDIOLINK_STUDIO_CONTROL_FILE=/tmp/castlink-ui-edit-control.json \
STUDIOLINK_MODERATOR_ACCESS_FILE=/tmp/castlink-ui-edit-moderators.json \
STUDIOLINK_STATS_DIR=/tmp/castlink-ui-edit-stats \
pnpm --filter web exec next dev -H 127.0.0.1 -p 3005
```

Ожидается сообщение готовности (`Ready`) и адрес `http://127.0.0.1:3005`. Откройте `/studio` или `/room`; изменения после сохранения появляются в dev-режиме. Остановка этого процесса — **Ctrl+C в его терминале**.

Это изолирует указанные файлы состояния, **но не весь медиасервер**: LiveKit и другие настройки могут наследоваться из `.env.local`. Для проверки создавайте новую тестовую комнату с уникальным именем; не подключайте этот стенд к действующему эфиру и не запускайте перенос серверов из него. Не меняйте секреты ради проверки дизайна. Для чисто текстовых/CSS-правок достаточно соответствующего экрана, узкого/широкого окна и двух тем.

### Проверить production-сборку без установки

```bash
NEXT_BUILD_DIR=.next-ui-check STUDIOLINK_RELEASE=ui-check pnpm --filter web build
```

Успех: компиляция/проверки завершены, выведена таблица маршрутов, команда завершилась с кодом0. Это **не переключает** рабочую службу на новый код. Next может добавить путь `.next-ui-check/types/**/*.ts` в `tsconfig.json`; проверьте diff и уберите только добавленный этой проверкой путь, если он не нужен постоянно. Не удаляйте чужие настройки.

После изменения функциональности выбирайте подходящую проверку, например:

```bash
node apps/web/tests/video-quality.cjs
node apps/web/tests/watch-subscriptions.cjs
node apps/web/tests/studio-stream-relay.cjs
```

Ожидается `PASS` или сообщение об успешном прохождении без исключений. Эти тесты относятся к качеству/просмотру/ретрансляции, не проверяют весь интерфейс. Для смены обычной подписи запуск всех тестов проекта не требуется.

### Что проверить глазами

Откройте изменённый экран в широком и узком окне, в тёмной и светлой теме. Проверьте оба состояния изменённой кнопки, её блокировку во время действия, отсутствие обрезанного текста и возможность прокрутки до конца списка. Для общего компонента проверьте все места использования. Для звука различайте «я не слышу» и «гость перестал публиковать микрофон».

## 10. Если изменения не видны

| Симптом | Что проверить |
| --- | --- |
| Поменял файл, на castlink.ru ничего не произошло | Локальная правка не обновляет VPS. Сначала проверить локально, затем отдельно устанавливать сборку |
| Изменил CSS, размер прежний | F12 → Elements → Styles/Computed: более позднее/точное правило, мобильный `@media`, inline `style`, `<style jsx>` |
| Смена названия только в одном месте | У текста несколько вхождений или общий компонент вызывается с разными параметрами |
| В админке поменялось, у модератора нет | Проверить `limited`, `accessMode` и соответствующий условный блок |
| У кнопки нет собственного текста в проекте | Она может быть частью LiveKit `ControlBar`; не править node_modules |
| localhost:3005 не открывается | Dev-процесс должен работать; проверить его терминал и `ss -ltn 'sport = :3005'` |
| EADDRINUSE | Порт занят; выбрать другой, не убивать рабочую службу |
| На одном ПК старый вид | Проверить адрес/версию, «Проверить обновления». Основную студию обновлять в перерыв |
| Сборка успешна, действие сломано | Сборка проверяет код, не факт успешного API/медиа. Посмотреть ошибку запроса и проверить обработчик |

Для сравнения установленного выпуска:

```bash
curl -fsS https://castlink.ru/api/version
curl -fsS --resolve caster.em.studio:443:192.168.53.68 https://caster.em.studio/api/version
```

На дату гайда нормальный ответ обоих серверов: `{"version":"0.9.23-panel-fixes"}`. В будущем версия будет другой. `--resolve` проверяет локальный HTTPS по нужному IP; это не изменение DNS. Не публикуйте cookies, invite-токены и содержимое `.env.local` из F12/терминала.

Дополнительно: [устройство проекта](PROJECT_GUIDE_RU.md), [работа в VS Code и GitHub](EDITING_AND_ACCESS_RU.md), [диагностика](TROUBLESHOOTING_RU.md), [неизменяемые принципы системы](CRITICAL_INVARIANTS_RU.md). Для UI-предпросмотра следуйте команде с отдельным портом из этого гайда: старые VS Code-задачи могут использовать рабочий порт3000.

Изменение0.9.23: TalkbackControls получает `visible={activeTab !== "statistics"}`; камера имеет свой предпросмотр и проверку `setPanelCamera`. В `/moderator` обозначение роли задаёт выбранная панель; metadata.panelMode не заменяет серверную авторизацию.

### Принадлежность блоков вкладкам (0.9.24)
В `apps/web/app/studio/page.tsx` и `apps/web/components/RoomControlConsole.tsx` видимость определяет `activeTab`: `studio`, `participants`, `statistics`. Настройки комнаты и устройств ограничены `studio`, даже если меню комнаты было открыто до перехода. Диагностика гостей в основной студии перенесена в отдельную таблицу вкладки `statistics`; управление гостями осталось в `participants`. `TalkbackControls.visible` в панели администратора/модератора включён только для `participants`. Сохраняйте `hidden` для существующих медиакомпонентов: условное размонтирование может сбросить предпросмотр. Названия навигации: «Участники и гости», «Статистика и графики».

### Камеры, поворот, выход и отчёты (0.9.25)
- Общая гостевая сетка и LAN Monitor: `apps/web/components/RoomConference.tsx`; фильтр `visible` определяет, кто виден, а `RotatedParticipantTile` подключает общий поворот.
- Кнопка «Повернуть на 90°»: `components/RotateVideoButton.tsx`. Серверные права и изменение угла: `app/api/participants/route.ts`, ветка `action === "rotate"`. Отображение и вписывание поворота: `lib/video-rotation.ts`. Не заменяйте это локальным CSS конкретной страницы, если изменение должно действовать у всех.
- Положение «Выйти из комнаты»: `app/globals.css`, `.room-leave-button`; отступ снизу предотвращает перекрытие содержимого. Обработчики: студия `app/studio/page.tsx`, персонал `components/RoomControlConsole.tsx`, гостевая сетка `RoomConference`, просмотр `app/watch/page.tsx`. Не удаляйте общую авторизацию при простом выходе из комнаты: это повлияет на другие открытые эфиры.
- «Открыть ещё одну студию»: `app/studio/page.tsx`, блок комнаты; пояснение выбора комнат — `components/StudioRoomPicker.tsx`. Для независимых эфиров выбирайте разные комнаты и нужный каждой источник.
- «Скачать наглядный отчёт»: `components/StatisticsDashboard.tsx`, функция `download`; дизайн автономного HTML и графиков — `lib/stats-report.ts`; формат CSV — `lib/stats-csv.ts`. Шаг сбора: `lib/rtc-telemetry.ts`; отдельная точность выгрузки 2 секунды: `lib/telemetry-store.ts` параметр `precise`, API `resolution=2s`. Пустые замеры нельзя заменять нулями.
- Устаревание статистики: `lib/studio-outbound-stats.ts`, `receiveStudioActual`, и `lib/studio-control.ts`, heartbeat. Не сравнивайте напрямую часы разных компьютеров и не обновляйте время неизменившегося замера каждым heartbeat.

### Компактная раскладка 0.9.26
Приглашения под монитором: `studio-invite-compact` в `app/studio/page.tsx` и `components/RoomControlConsole.tsx`; CSS-сетка на 6 колонок размещает 3 кнопки создания (по 2 колонки) и 2 отзыва (по 3). Компоненты AdminInviteButton/ModeratorInviteButton сохраняют обработчики и используют классы invite-create/invite-revoke. Выход в sidebar: sidebar-leave-button после sidebar-footer. Карточки гостей: guest-card-monitoring рядом с URL, guest-card-meter с компактным GuestAudioMeter, guest-card-details со сведениями. Разметка — app/studio/page.tsx; размеры и адаптация — конец app/globals.css. Названия навигации сокращены до «Участники» и «Статистика».
