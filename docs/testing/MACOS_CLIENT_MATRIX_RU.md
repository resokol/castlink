# macOS client: проверка переноса

База: публичный `client-v1.0.0-rc.9-a994895c5fa9`.
Обязательные архитектуры: arm64 и Intel x64, без замены Intel проверкой Rosetta.
Промежуточный пакет — development candidate, не полный перенос и не публичный выпуск.

| Проверка | arm64 | Intel x64 |
| --- | --- | --- |
| Нативный runner / SDK | Ожидает Actions | Ожидает Actions |
| Desktop contracts | Ожидает Actions | Ожидает Actions |
| Native API compile / observation | Ожидает Actions | Ожидает Actions |
| app/DMG/ZIP packaging | Ожидает Actions | Ожидает Actions |
| Запуск упакованного приложения | NOT VERIFIED | NOT VERIFIED |
| Камера / микрофон / screen TCC | NOT VERIFIED | NOT VERIFIED |
| Изолированный звук приложения | NOT IMPLEMENTED | NOT IMPLEMENTED |
| PowerPoint / PDF native control | NOT IMPLEMENTED | NOT IMPLEMENTED |
| Remote input / geometry / watchdog | NOT IMPLEMENTED | NOT IMPLEMENTED |
| macOS server setup / Docker / SSH | NOT IMPLEMENTED | NOT IMPLEMENTED |
| Обновление DMG / сохранение данных | Контрактные тесты; OS NOT VERIFIED | Контрактные тесты; OS NOT VERIFIED |

Native probe только наблюдает доступность API/разрешений; он не синтезирует ввод,
не запрашивает TCC согласия и не доказывает захват/управление. Runtime capability
и готовность полного переноса не выводятся из compile PASS.

Минимальный deployment target кандидата macOS13.0 — техническое решение для
ScreenCaptureKit audio API, не проверка запуска на macOS13. Полная совместимость
и версии PowerPoint устанавливаются по отдельным реальным сценариям.
