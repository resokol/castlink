# CastLink Server Windows / WSL 1.0.7

Стабильный сервер для Windows 11 x64 на WSL2, без Docker Desktop, на основе принятой версии castlink.ru.

- Исправлена совместимость потока студии со встроенным браузером vMix, где отсутствуют новые статические методы AbortSignal.
- Включены диагностика аудио/видео, JSON-экспорт истории, оценка сети за 10 секунд и родная панель Windows со статистикой за 24 часа.
- Обслуживание поддерживает точные опубликованные WSL 1.0.5-rc.1, rc.2, rc.3 и 1.0.6-rc.1 с сохранением данных, настроек и сертификатов; неизвестные сборки не принимаются.

Новая установка: `install-server-windows.ps1`. Существующий WSL-сервер: скачайте и распакуйте `CastLink-Server-WSL-Maintenance.zip`, запустите `CastLink-Maintenance.cmd`, выберите прежнюю установку, нажмите «Проверить», затем «Обновить». Обновляйте вне эфира, сверьте `SHA256SUMS`, затем перезагрузите страницы студии/кастеров и браузерные источники OBS/vMix.

Windows Client остаётся на стабильной версии 1.0.1. Автоматический перенос Docker → WSL2 не поддерживается; прежние Docker-пакеты остаются Legacy.

Source: `0d16de2e782cd2e847e9824024c5b788a080a59b`
Build: `1.0.7-0d16de2e782c`

[Русский](https://github.com/resokol/castlink/blob/main/distribution/RELEASE_NOTES_1_0_7.md) · [English](https://github.com/resokol/castlink/blob/main/distribution/docs/en/RELEASE_NOTES_1_0_7.md) · [简体中文](https://github.com/resokol/castlink/blob/main/distribution/docs/zh-CN/RELEASE_NOTES_1_0_7.md)

[Установка и обновление](https://github.com/resokol/castlink/blob/main/distribution/SERVER_INSTALL.md) · [Все пакеты](https://github.com/resokol/castlink/blob/main/distribution/PRODUCTS.md)
