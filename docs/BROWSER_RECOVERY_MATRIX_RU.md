# CastLink 1.0: браузеры, reconnect и recovery

Дата: 29.09.2026

## Цель

Recoverable-сетевые события не должны требовать reload страницы. LiveKit сначала выполняет собственный ICE/signaling reconnect; интерфейс CastLink показывает состояние, а после успешного восстановления повторно применяет подписки/вывод устройств.

Состояния UI:
- **Подключение** — первичное подключение или ручной retry;
- **Переподключение** — LiveKit выполняет reconnect;
- **Восстановлено** — reconnect завершён;
- **Онлайн** — стабильное соединение;
- **Нет связи** — автоматическое восстановление исчерпано; доступен retry без reload страницы.

## Целевая матрица 1.0

| Платформа | Браузер | Статус поддержки | Особенности |
| --- | --- | --- | --- |
| Windows 10/11 | Chrome current | основной desktop target | полный WebRTC; выбор audio output зависит от `setSinkId` |
| Windows 10/11 | Edge current | основной desktop target | Chromium-поведение; выбор audio output зависит от `setSinkId` |
| macOS | Chrome current | target | требуется физическая QA камеры/микрофона/output |
| macOS | Safari current | target с ограничениями API | функции включаются по feature detection; выбор output может быть недоступен |
| iOS/iPadOS | Safari current | mobile target | browser lifecycle/background и autoplay строже desktop; screen share зависит от WebKit/API |
| Android | Chrome current | mobile target | смена Wi-Fi/mobile должна проходить через ICE restart/reconnect |

Версия браузера намеренно не зашита в код. CastLink проверяет наличие API (`mediaDevices`, `setSinkId`, `getDisplayMedia`) и показывает ограничения вместо ложного успеха.

## Реализованное recovery

### Guest room

- слушаются `RoomEvent.Reconnecting` / `Reconnected` / `Disconnected`;
- reconnect не размонтирует страницу и не создаёт второй Room;
- после `Reconnected` UI показывает «Восстановлено», затем «Онлайн»;
- после окончательного disconnect доступна кнопка повторного подключения без reload;
- при ручном retry повторно включаются микрофон/камера согласно выбранным настройкам;
- повторный connect использует тот же пользовательский контекст и не создаёт DOM-дубликаты удалённых участников.

### Admin / moderator

- те же состояния Connecting/Reconnecting/Recovered/Failed;
- при исчерпанном reconnect доступен существующий retry;
- room-control polling продолжает отдельно отслеживать server-side lease/access.

### Studio Return viewer

- во время reconnect показывается статус;
- после `Reconnected` повторно применяются audio/video subscription preferences;
- окончательный failure имеет retry без reload.

### Clean output / vMix

- служебный UI не добавляется;
- при reconnect feed очищается, чтобы не оставлять frozen frame;
- после `Reconnected` целевой participant/track повторно подписывается и существующий track повторно attach-ится.

### Устройства

- picker обновляет список по `devicechange`;
- выбранный audio output повторно применяется после LiveKit `Reconnected`;
- если выбранный конкретный микрофон пропал, guest пытается временно перейти на системный input;
- если выбранная конкретная камера пропала, guest пытается перейти на другую доступную камеру;
- когда ранее выбранное устройство снова появляется, CastLink пытается вернуть его без refresh;
- ошибки переключения показываются пользователю и не выдаются за успешное восстановление.

### Return video stall

Существующий `studio-video-recovery.ts` отслеживает длительный decoder/frame stall. Краткая остановка игнорируется; при подтверждённом stall подписка снимается и восстанавливается, если participant/track ещё актуальны и соединение Connected.

## Manual QA matrix перед закрытием Issue #4

Для каждого реально доступного браузера выполнить:

1. Обычное подключение гостя, camera + microphone.
2. Кратко отключить сеть на 3–10 секунд и вернуть её.
3. Переключить Wi-Fi ↔ hotspot/mobile network.
4. Увести устройство в sleep/background и вернуть.
5. Отключить активную USB-камеру/микрофон и подключить обратно.
6. Проверить, что нет дублей participant tiles/tracks.
7. Проверить Studio Return viewer.
8. Проверить clean output в браузерном input vMix.
9. В статистике убедиться, что reconnect counter увеличился, а transport/candidate type снова заполняются.
10. Для TURN acceptance отдельно заблокировать direct UDP и подтвердить `candidateType=relay`.

## Что автоматизировано

CI проверяет:
- state machine Connecting → Reconnecting → Recovered → Online / Failed;
- наличие retry без page reload;
- обработчики guest reconnect;
- re-subscribe clean output после reconnect;
- повторное применение output sink;
- device unplug/replug recovery wiring;
- существующий decoder-stall recovery.

Автоматические тесты не заменяют физическую QA камеры/микрофона и реальную смену сети на iOS/Android/macOS.

## Известные ограничения

- Если браузер сам завершил media permission или ОС не предоставляет fallback input, CastLink не может создать устройство программно: UI покажет ошибку.
- После `PARTICIPANT_REMOVED` автоматический retry намеренно не выполняется: это server-side kick/revoke, а не сетевой сбой.
- Полностью завершённый LiveKit reconnect может потребовать новый connect; retry выполняется внутри текущей страницы, но просроченный/отозванный access token всё равно требует повторной авторизации.
- Browser sleep/background policies отличаются по платформам; окончательная поддержка конкретной версии фиксируется только после manual QA.
