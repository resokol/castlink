# CastLink Server WSL 1.0.2-rc.8

## Русский

Предварительный серверный выпуск для Windows 11 x64 (build 22621+) и WSL2 2.4.13+.
Готовая Linux-среда включает CastLink, PostgreSQL, LiveKit, TURN, HTTPS и конвертер PPTX.
Docker Desktop и сборка исходников на ПК не требуются. Это отдельная установка;
обновление существующего Docker/WSL-сервера и перенос его данных не реализованы.

Добавлены графики CPU/RAM/диска/сети, комнат, подключений и кастеров; история
показателей и журнал событий/ошибок сохраняются 24 часа, включая перезапуски.
Доступ к мониторингу требует авторизации владельца сервера. Исправлены owner-ссылки
за HTTPS-прокси, выбор локального RTC-интерфейса в WSL и краткая блокировка файла
состояния Windows при остановке/запуске.

Скачайте `install-server-windows.ps1` из этого выпуска и проверьте `SHA256SUMS`.
Запуск: `powershell -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Action Install`.
Скрипт запросит адрес и пароль; может предложить WSL, настройки сети, firewall,
доверие локальному CA текущего пользователя и автозапуск при входе в Windows.
При необходимости перезагрузки повторите команду после ручного Restart.
Для доступа извне нужны DNS/маршрутизатор/firewall и доверенный HTTPS; локальный CA
нужно установить на клиентских устройствах. Управление тем же скриптом:
`-Action Start`, `Stop`, `Status`, `OwnerAccess`. Остановка сохраняет данные.

Пакет: source `d9a0c6465b512562766fcb42726a59dcdf3fb5c2`, factory `43256796399`.
Полный аудит rootfs, исходников зависимостей и побайтовая повторная упаковка прошли.
Этот draft не означает завершение внешней медиа-проверки и реального входа после
перезапуска Windows; результаты будут добавлены перед публикацией.

## English

Preview server release for Windows 11 x64 build 22621+ and WSL2 2.4.13+.
The ready Linux environment includes CastLink, PostgreSQL, LiveKit, TURN, HTTPS and
PPTX conversion. Docker Desktop and local compilation are unnecessary. This is a
separate installation; upgrading an existing Docker/WSL server and migrating its
data are not implemented.

Server charts cover CPU/RAM/disk/network, rooms, connections and casters. Metric
history and the event/error journal persist for 24 hours across restarts. Monitoring
requires server-owner authorization. Fixes cover owner links behind an HTTPS proxy,
WSL local RTC interface selection, and short Windows state-file sharing conflicts.

Download this release's `install-server-windows.ps1` and verify `SHA256SUMS`.
Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Action Install`.
The script asks for an address and password, and may offer WSL prerequisites,
network/firewall setup, current-user local CA trust and start at Windows sign-in.
If a restart is needed, restart manually and run the same command again. External
access requires DNS/router/firewall configuration and trusted HTTPS; client devices
must trust a local CA when used. Use the same script with `-Action Start`, `Stop`,
`Status` or `OwnerAccess`. Stop preserves data.

Source `d9a0c6465b512562766fcb42726a59dcdf3fb5c2`; factory `43256796399`.
Full rootfs/dependency-source audit and byte-identical repackaging passed. This draft
does not certify external media or actual post-restart Windows sign-in; results
will be added before publication.

## 简体中文

适用于 Windows 11 x64 build 22621+ 和 WSL2 2.4.13+ 的服务器预览版。
预构建 Linux 环境包含 CastLink、PostgreSQL、LiveKit、TURN、HTTPS 和 PPTX 转换器，
无需 Docker Desktop 或在本机编译。本版本为独立安装；尚不支持升级现有 Docker/WSL
服务器或迁移其数据。

服务器图表显示 CPU、内存、磁盘、网络、房间、连接和投屏用户。指标历史及事件/错误
日志保留 24 小时，重启后仍可查看；需要服务器所有者授权。修复 HTTPS 代理后的所有者
链接、WSL 本地 RTC 接口选择，以及 Windows 状态文件的短暂共享冲突。

下载本发行版的 `install-server-windows.ps1` 并核对 `SHA256SUMS`。
运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Action Install`。
脚本询问地址和密码，并可能提示安装 WSL、配置网络/防火墙、信任当前用户的本地 CA
及启用 Windows 登录自启动。如需重启，请手动重启后再次运行相同命令。外部访问需要
DNS、路由器、防火墙及受信任 HTTPS；使用本地 CA 时客户端也需要信任它。
同一脚本支持 `-Action Start`、`Stop`、`Status`、`OwnerAccess`，停止会保留数据。

源码 `d9a0c6465b512562766fcb42726a59dcdf3fb5c2`；构建 `43256796399`。
完整 rootfs、依赖源码审计及逐字节重复打包检查已通过。此草稿不表示外部媒体及 Windows
实际重启登录验证已完成；发布前将补充结果。
