# Shared GUI-only catalog; importing this file does not read or write preferences.
$script:SimpleGuiTranslations=@{
  'Задайте пароль создания комнат (8–256 символов; только для студии)'=@{en='Set the room creation password (8–256 characters; studio only)';'zh-CN'='设置创建房间密码（8–256 个字符；仅供演播室使用）'}
  'Повторите пароль создания комнат'=@{en='Repeat the room creation password';'zh-CN'='再次输入创建房间密码'}
  'Пароль создания комнат: от 8 до 256 символов, без переводов строк и пустого значения.'=@{en='Room creation password: 8 to 256 characters, with no line breaks or blank value.';'zh-CN'='创建房间密码：8 至 256 个字符，不可包含换行或仅为空白。'}
  'Пароли создания комнат не совпадают. Повторите настройку.'=@{en='The room creation passwords do not match. Run setup again.';'zh-CN'='两次输入的创建房间密码不一致。请重新设置。'}
  'Сохранённая настройка пароля создания комнат повреждена. Действующий пароль не изменён.'=@{en='The saved room creation password setting is invalid. The current password was preserved.';'zh-CN'='保存的创建房间密码设置无效。当前密码未更改。'}
  'Настройки пароля создания комнат неоднозначны. Действующий пароль не изменён.'=@{en='The room creation password settings are ambiguous. The current password was preserved.';'zh-CN'='创建房间密码设置存在歧义。当前密码未更改。'}
  'Сохранённые настройки пароля создания комнат не совпадают. Действующий пароль не изменён.'=@{en='The saved room creation password settings do not match. The current password was preserved.';'zh-CN'='保存的创建房间密码设置不一致。当前密码未更改。'}
  'Настроен пароль создания комнат вручную. Сохраните его SHA-256 в настройке ROOM_CREATION_PASSWORD_SHA256 перед обновлением.'=@{en='A room creation password was configured manually. Save its SHA-256 in ROOM_CREATION_PASSWORD_SHA256 before updating.';'zh-CN'='已手动配置创建房间密码。更新前，请将其 SHA-256 保存到 ROOM_CREATION_PASSWORD_SHA256。'}
  'Расширенная установка сохраняет внешний адрес сайта. Используй сохранённые настройки или новую папку для другой сетевой схемы.'=@{en='Advanced setup preserves the public site URL. Use its saved settings or a new folder for a different network layout.';'zh-CN'='高级安装会保留外部网站地址。请使用已保存的设置，或为其他网络部署方式选择新文件夹。'}
  'Установка: 1 — Быстрая (рекомендуется); 2 — Расширенная'=@{en='Setup: 1 — Quick (recommended); 2 — Advanced';'zh-CN'='安装：1 — 快速安装（推荐）；2 — 高级安装'}
  'Быстрая (рекомендуется)'=@{en='Quick (recommended)';'zh-CN'='快速安装（推荐）'}
  'Расширенная'=@{en='Advanced';'zh-CN'='高级安装'}
  'Расширенная установка'=@{en='Advanced setup';'zh-CN'='高级安装'}
  'Сеть: 1 — HTTPS напрямую; 2 — HTTP; 3 — За внешним прокси'=@{en='Network: 1 — Direct HTTPS; 2 — HTTP; 3 — Behind an external proxy';'zh-CN'='网络：1 — 直接 HTTPS；2 — HTTP；3 — 使用外部反向代理'}
  'HTTPS напрямую'=@{en='Direct HTTPS';'zh-CN'='直接 HTTPS'}
  'За внешним прокси'=@{en='Behind an external proxy';'zh-CN'='使用外部反向代理'}
  'Внешний адрес сайта'=@{en='Public site URL';'zh-CN'='网站外部地址'}
  'IPv4 для прослушивания сайта'=@{en='Site listening IPv4';'zh-CN'='网站监听 IPv4'}
  'HTTP порт сайта'=@{en='Site HTTP port';'zh-CN'='网站 HTTP 端口'}
  'HTTPS порт сайта'=@{en='Site HTTPS port';'zh-CN'='网站 HTTPS 端口'}
  'HTTP порт для сертификата и перенаправления'=@{en='HTTP port for certificates and redirects';'zh-CN'='证书和重定向使用的 HTTP 端口'}
  'Доверенные прокси (IP/CIDR через запятую)'=@{en='Trusted proxies (comma-separated IP/CIDR)';'zh-CN'='受信任代理（以逗号分隔的 IP/CIDR）'}
  'IPv4 для медиаподключений'=@{en='IPv4 advertised for media connections';'zh-CN'='媒体连接公布的 IPv4'}
  'TCP порт медиаподключений'=@{en='Media TCP port';'zh-CN'='媒体 TCP 端口'}
  'UDP порт медиаподключений'=@{en='Media UDP port';'zh-CN'='媒体 UDP 端口'}
  'UDP порт TURN'=@{en='TURN UDP port';'zh-CN'='TURN UDP 端口'}
  'Начало диапазона TURN'=@{en='First TURN relay port';'zh-CN'='TURN 中继起始端口'}
  'Конец диапазона TURN'=@{en='Last TURN relay port';'zh-CN'='TURN 中继结束端口'}
  'Порт должен быть целым числом от 1 до 65535.'=@{en='The port must be an integer from 1 to 65535.';'zh-CN'='端口必须为 1 至 65535 之间的整数。'}
  'Прокси должен передавать Host, X-Forwarded-Proto и X-Forwarded-For; WebSocket /rtc тоже проходит через прокси. Медиапорты настраиваются отдельно.'=@{en='The proxy must forward Host, X-Forwarded-Proto and X-Forwarded-For, including WebSocket /rtc. Configure media ports separately.';'zh-CN'='代理必须转发 Host、X-Forwarded-Proto 和 X-Forwarded-For，并支持 WebSocket /rtc。媒体端口需单独配置。'}
  'Обычный HTTP вне localhost ограничивает камеру, микрофон и показ экрана в браузере. Для работы с других устройств используй HTTPS или внешний HTTPS-прокси.'=@{en='Plain HTTP outside localhost restricts browser camera, microphone and screen sharing. Use HTTPS or an external HTTPS proxy for other devices.';'zh-CN'='在 localhost 以外使用普通 HTTP 会限制浏览器的摄像头、麦克风和屏幕共享。其他设备请使用 HTTPS 或外部 HTTPS 代理。'}
  'Выбраны другие сетевые параметры сохранённой установки. Обновление сохраняет прежнюю конфигурацию; выбери новую папку для новой установки.'=@{en='The network settings differ from the saved installation. Updates preserve its configuration; choose a new folder for a new installation.';'zh-CN'='网络设置与已保存的安装不同。更新会保留原配置；如需新安装，请选择新文件夹。'}
  'Этот пакет не поддерживает расширенную установку. Нужен новый полный пакет CastLink.'=@{en='This package does not support advanced setup. Use a new complete CastLink package.';'zh-CN'='此安装包不支持高级安装。请使用新的完整 CastLink 安装包。'}
  'Опубликованный пакет пока не поддерживает расширенную установку. Нужен полный выпуск с сетевыми режимами.'=@{en='The published package does not yet support advanced setup. A complete release with network modes is required.';'zh-CN'='已发布的安装包尚不支持高级安装。需要包含网络模式的完整版本。'}
  'Укажи только один источник сетевой конфигурации.'=@{en='Specify only one network configuration source.';'zh-CN'='请仅指定一个网络配置来源。'}
  'Файл сетевой конфигурации превышает 64 КБ.'=@{en='The network configuration file exceeds 64 KB.';'zh-CN'='网络配置文件超过 64 KB。'}
  'Этот пакет не поддерживает сохранённые сетевые параметры.'=@{en='This package does not support the saved network settings.';'zh-CN'='此安装包不支持已保存的网络设置。'}
  'Укажи корректный IPv4-адрес сети.'=@{en='Enter a valid network IPv4 address.';'zh-CN'='请输入有效的网络 IPv4 地址。'}
  'Сетевой порт должен быть целым числом от 1 до 65535.'=@{en='The network port must be an integer from 1 to 65535.';'zh-CN'='网络端口必须为 1 至 65535 之间的整数。'}
  'Укажи полный HTTP/HTTPS-адрес без пути, пароля, параметров и фрагмента.'=@{en='Enter a full HTTP/HTTPS origin without a path, credentials, query or fragment.';'zh-CN'='请输入完整的 HTTP/HTTPS 地址，不含路径、凭据、查询参数或片段。'}
  'Укажи корректное имя сервера или IPv4-адрес.'=@{en='Enter a valid server hostname or IPv4 address.';'zh-CN'='请输入有效的服务器主机名或 IPv4 地址。'}
  'Укажи доверенные адреса или CIDR прокси явно; доверие всей сети запрещено.'=@{en='Specify trusted proxy addresses or CIDRs explicitly; trusting all addresses is not allowed.';'zh-CN'='请明确指定受信任代理的地址或 CIDR；不允许信任所有地址。'}
  'Выбери сетевой режим HTTPS, HTTP или внешний прокси.'=@{en='Choose HTTPS, HTTP or external proxy network mode.';'zh-CN'='请选择 HTTPS、HTTP 或外部代理网络模式。'}
  'Публичный адрес не соответствует выбранному сетевому режиму.'=@{en='The public URL does not match the selected network mode.';'zh-CN'='外部地址与所选网络模式不匹配。'}
  'Порт публичного адреса должен совпадать с портом HTTP или HTTPS.'=@{en='The public URL port must match the configured HTTP or HTTPS port.';'zh-CN'='外部地址的端口必须与配置的 HTTP 或 HTTPS 端口一致。'}
  'Диапазон TURN должен содержать от 1 до 1024 портов по возрастанию.'=@{en='The TURN range must contain 1 to 1024 ports in ascending order.';'zh-CN'='TURN 范围必须按升序包含 1 至 1024 个端口。'}
  'Сетевые порты одного протокола пересекаются. Выбери разные порты.'=@{en='Ports using the same protocol overlap. Choose different ports.';'zh-CN'='同一协议的端口存在冲突。请选择不同的端口。'}
  'Для внешнего прокси укажи хотя бы один доверенный IP-адрес или CIDR.'=@{en='Specify at least one trusted proxy IP address or CIDR.';'zh-CN'='请为外部代理指定至少一个受信任的 IP 地址或 CIDR。'}
  'TURN/TLS 443 совместим только с прямым публичным HTTPS, портами 80/443 и привязкой 0.0.0.0.'=@{en='TURN/TLS 443 requires direct public HTTPS, ports 80/443 and binding 0.0.0.0.';'zh-CN'='TURN/TLS 443 需要直接公共 HTTPS、80/443 端口和 0.0.0.0 监听地址。'}
  'Выбери быструю или расширенную установку.'=@{en='Choose quick or advanced setup.';'zh-CN'='请选择快速安装或高级安装。'}
  'Доступен по HTTP'=@{en='Available over HTTP';'zh-CN'='可通过 HTTP 访问'}
  'HTTP недоступен'=@{en='HTTP unavailable';'zh-CN'='HTTP 不可用'}
  'HTTP пока не готов'=@{en='HTTP is not ready';'zh-CN'='HTTP 尚未就绪'}
  'Сохранённая сеть завершённой установки не совпала. Используй прежние настройки или новую папку.'=@{en='The completed installation has different saved network settings. Use its existing settings or a new folder.';'zh-CN'='已完成安装的网络设置与保存的配置不同。请使用原设置或新文件夹。'}
  'Проверка сайта и готовности'=@{en='Checking the site and readiness';'zh-CN'='正在检查网站和就绪状态'}
  'Сайт ещё не готов. Проверь порт, адрес и конфигурацию прокси; данные установки сохранены.'=@{en='The site is not ready. Check the port, URL and proxy configuration; installation data is retained.';'zh-CN'='网站尚未就绪。请检查端口、地址和代理配置；安装数据已保留。'}
  'Внутренний HTTP проверен. Внешний HTTPS-прокси должен быть настроен отдельно; его доступность пока не подтверждена.'=@{en='Internal HTTP was verified. Configure the external HTTPS proxy separately; its reachability has not been confirmed.';'zh-CN'='内部 HTTP 已通过检查。外部 HTTPS 代理需另行配置；其可访问性尚未确认。'}
  'Версия неизвестна'=@{en='Version unknown';'zh-CN'='版本未知'}
  'Версия {0}'=@{en='Version {0}';'zh-CN'='版本 {0}'}
  'Сборка {0}'=@{en='Build {0}';'zh-CN'='构建 {0}'}
  'Запускаю CastLink…'=@{en='Starting CastLink…';'zh-CN'='正在启动 CastLink…'}
  'Запуск…'=@{en='Starting…';'zh-CN'='正在启动…'}
  'запускается'=@{en='Starting';'zh-CN'='正在启动'}
  'Останавливаю CastLink…'=@{en='Stopping CastLink…';'zh-CN'='正在停止 CastLink…'}
  'Остановка…'=@{en='Stopping…';'zh-CN'='正在停止…'}
  'останавливается'=@{en='Stopping';'zh-CN'='正在停止'}
  'Прошло {0} с'=@{en='Elapsed {0}s';'zh-CN'='已用时 {0} 秒'}
  'Статус служб недоступен'=@{en='Service status unavailable';'zh-CN'='无法获取服务状态'}
  'Завершение установки: передача управления панели'=@{en='Completing setup: opening the control panel';'zh-CN'='正在完成安装：打开控制面板'}
  'Проверки завершены. Службы продолжают работать; управление передаётся панели CastLink.'=@{en='Checks completed. Services keep running; control is handed to the CastLink panel.';'zh-CN'='检查已完成。服务继续运行；控制权交给 CastLink 面板。'}
  'Ярлык CastLink на рабочем столе открывает панель и сайт. Закрытие окна скрывает панель в трей; службы продолжают работать. Кнопка «Остановить службы» останавливает только этот CastLink, данные сохраняются.'=@{en='The desktop CastLink shortcut opens the panel and site. Closing the window hides the panel to the tray; services keep running. Stop services stops only this CastLink installation and retains data.';'zh-CN'='桌面 CastLink 快捷方式打开面板和网站。关闭窗口会将面板隐藏到系统托盘；服务继续运行。“停止服务”仅停止此 CastLink 安装的服务并保留数据。'}

  'Мастер установки'=@{en='Setup wizard';'zh-CN'='安装向导'}
  'Подготовка мастера…'=@{en='Preparing the wizard…';'zh-CN'='正在准备向导…'}
  'Подготовка'=@{en='Preparation';'zh-CN'='准备'}
  'Подождите, пока мастер подготовит следующий шаг.'=@{en='Please wait while the wizard prepares the next step.';'zh-CN'='请等待向导准备下一步。'}
  'Подробности выполнения'=@{en='Execution details';'zh-CN'='执行详情'}
  'Ответ на вопрос мастера'=@{en='Wizard answer';'zh-CN'='向导问题的回答'}
  'Пароль'=@{en='Password';'zh-CN'='密码'}
  'Журнал выполнения'=@{en='Execution log';'zh-CN'='执行日志'}
  'Ход выполнения'=@{en='Progress';'zh-CN'='进度'}
  'Выбрать папку…'=@{en='Choose folder…';'zh-CN'='选择文件夹…'}
  'Назад'=@{en='Back';'zh-CN'='返回'}
  'Отмена'=@{en='Cancel';'zh-CN'='取消'}
  'Повторить'=@{en='Retry';'zh-CN'='重试'}
  'Продолжить'=@{en='Continue';'zh-CN'='继续'}
  'Закрыть'=@{en='Close';'zh-CN'='关闭'}
  'Язык'=@{en='Language';'zh-CN'='语言'}
  'Language'=@{en='Language';'zh-CN'='语言'}
  'Russian'=@{en='Russian';'zh-CN'='俄语'}
  'English'=@{en='English';'zh-CN'='英语'}
  'Chinese'=@{en='Simplified Chinese';'zh-CN'='简体中文'}
  'Подготавливаю мастер…'=@{en='Preparing the wizard…';'zh-CN'='正在准备向导…'}
  'Ожидаю твой выбор'=@{en='Waiting for your choice';'zh-CN'='等待您的选择'}
  'Выполняю выбранный шаг…'=@{en='Running the selected step…';'zh-CN'='正在执行所选步骤…'}
  'Возвращаюсь к этапам мастера…'=@{en='Returning to the setup steps…';'zh-CN'='正在返回安装步骤…'}
  'Папка CastLink'=@{en='CastLink folder';'zh-CN'='CastLink 文件夹'}
  'Пароль используется только в памяти и не сохраняется.'=@{en='The password is kept only in memory and is not saved.';'zh-CN'='密码仅保存在内存中，不会写入文件。'}
  'Технические сообщения показаны в подробностях выполнения на исходном языке.'=@{en='Technical messages are shown in their original language in execution details.';'zh-CN'='技术消息以原始语言显示在执行详情中。'}
  'Мастер выполняет шаг. Дождись его завершения или отмени действие в вопросе мастера. Данные не будут удалены принудительным обрывом.'=@{en='The wizard is running a step. Wait for it to finish or cancel at a wizard question. Closing cannot force deletion of data.';'zh-CN'='向导正在执行步骤。请等待完成，或在向导提问时取消。关闭窗口不会强制删除数据。'}
  'Закрой мастер для завершения очистки файлов'=@{en='Close the wizard to finish file cleanup';'zh-CN'='关闭向导以完成文件清理'}
  'Действие отменено'=@{en='Operation cancelled';'zh-CN'='操作已取消'}
  'Нужна перезагрузка Windows'=@{en='Windows restart required';'zh-CN'='需要重启 Windows'}
  'Действие остановлено'=@{en='Operation stopped';'zh-CN'='操作已停止'}
  'Действие мастера завершено'=@{en='Wizard operation completed';'zh-CN'='向导操作已完成'}
  'Отдельный процесс продолжит очистку после закрытия окна. При отказе сохраняется отчёт; пока результат очистки не подтверждён.'=@{en='A separate process will continue cleanup after this window closes. Failures are recorded in a report; cleanup has not yet been confirmed.';'zh-CN'='关闭窗口后，单独的进程将继续清理。失败时会保存报告；目前尚未确认清理完成。'}
  'Действие отменено на вопросе мастера. Сохранённые данные оставлены для продолжения.'=@{en='The operation was cancelled at a wizard question. Saved data is retained so you can continue.';'zh-CN'='操作已在向导提问时取消。已保存的数据会保留，以便继续。'}
  'Адрес сервера, дальнейшие действия и причины сохранения компонентов показаны в журнале.'=@{en='The server address, next steps and reasons for retaining components are shown in the log.';'zh-CN'='服务器地址、后续步骤及保留组件的原因见日志。'}
  'Открой адрес или скопируй его. Создай комнату и задай пароль студии; гостевой пароль задаётся отдельно. Для LAN другим устройствам требуется доверие сертификату из переносимого комплекта.'=@{en='Open or copy the address. Create a room and set its studio password; the guest password is separate. For LAN access, other devices must trust the certificate from the portable kit.';'zh-CN'='打开或复制地址。创建房间并设置演播室密码；访客密码单独设置。局域网内的其他设备需信任便携证书包中的证书。'}
  'Открыть CastLink'=@{en='Open CastLink';'zh-CN'='打开 CastLink'}
  'Сервер готов; доверие HTTPS не установлено'=@{en='Server ready; HTTPS certificate not trusted';'zh-CN'='服务器已就绪；HTTPS 证书尚未受信任'}
  'Сервер готов, но доверие HTTPS не установлено. Подтверди Windows Security Warning через Install-Certificate.cmd в комплекте и перезапусти браузер.'=@{en='The server is ready, but its HTTPS certificate is not trusted. Confirm the Windows Security Warning using Install-Certificate.cmd in the kit, then restart your browser.';'zh-CN'='服务器已就绪，但 HTTPS 证书尚未受信任。请运行证书包中的 Install-Certificate.cmd 并确认 Windows 安全警告，然后重启浏览器。'}
  'Сервер готов, но доверие HTTPS не установлено. Подтверди сертификат.'=@{en='The server is ready, but its HTTPS certificate is not trusted. Confirm the certificate.';'zh-CN'='服务器已就绪，但 HTTPS 证书尚未受信任。请确认该证书。'}
  'CastLink: 1 — Установить; 2 — Обновить; 3 — Удалить'=@{en='CastLink: 1 — Install; 2 — Update; 3 — Remove';'zh-CN'='CastLink：1 — 安装；2 — 更新；3 — 卸载'}
  'Установить'=@{en='Install';'zh-CN'='安装'}
  'Обновить'=@{en='Update';'zh-CN'='更新'}
  'Где обновить CastLink? 1 — Локально; 2 — Внешний сервер'=@{en='Where should CastLink be updated? 1 — Locally; 2 — Remote server';'zh-CN'='在哪里更新 CastLink？1 — 本机；2 — 远程服务器'}
  'Для обновления VPS выбери прежнюю папку сохранённых данных мастера на этом ПК. Без неё нельзя подтвердить существующую установку; новая установка не начата.'=@{en='To update the VPS, choose the original saved wizard data folder on this PC. Without it the existing installation cannot be confirmed; no new installation has started.';'zh-CN'='要更新 VPS，请选择此电脑上原先保存的向导数据文件夹。没有该文件夹无法确认现有安装；未开始新的安装。'}
  'Для обновления выбери папку существующей установки CastLink. Для новой установки выбери «Установить».'=@{en='To update, choose an existing CastLink installation folder. For a new installation choose Install.';'zh-CN'='要更新，请选择现有 CastLink 安装文件夹。新安装请选择“安装”。'}
  'CastLink: 1 — установить / обновить; 2 — удалить'=@{en='CastLink: 1 — install / update; 2 — remove';'zh-CN'='CastLink：1 — 安装 / 更新；2 — 卸载'}
  'Где установить CastLink? 1 — Локально; 2 — Внешний сервер'=@{en='Where should CastLink be installed? 1 — Locally; 2 — Remote server';'zh-CN'='在哪里安装 CastLink？1 — 本机；2 — 远程服务器'}
  'Где удалить CastLink? 1 — Локально; 2 — Внешний сервер'=@{en='Where should CastLink be removed? 1 — Locally; 2 — Remote server';'zh-CN'='从哪里卸载 CastLink？1 — 本机；2 — 远程服务器'}
  'Удалить: 1 — Локально; 2 — Внешний сервер'=@{en='Remove: 1 — Locally; 2 — Remote server';'zh-CN'='卸载：1 — 本机；2 — 远程服务器'}
  'установить / обновить'=@{en='Install / update';'zh-CN'='安装 / 更新'}
  'удалить'=@{en='Remove';'zh-CN'='卸载'}
  'Локально'=@{en='Locally';'zh-CN'='本机'}
  'Внешний сервер'=@{en='Remote server';'zh-CN'='远程服务器'}
  'Да'=@{en='Yes';'zh-CN'='是'}
  'Нет'=@{en='No';'zh-CN'='否'}
  'Продолжить незавершённую установку? да/нет'=@{en='Continue the unfinished installation? yes/no';'zh-CN'='继续未完成的安装？是/否'}
  'Папка установки и данных мастера'=@{en='Installation and wizard data folder';'zh-CN'='安装文件和向导数据文件夹'}
  'Папка сохранённых данных мастера на этом ПК'=@{en='Saved wizard data folder on this PC';'zh-CN'='此电脑上的向导数据保存文件夹'}
  'Папка установки'=@{en='Installation folder';'zh-CN'='安装文件夹'}
  'Папка'=@{en='Folder';'zh-CN'='文件夹'}
  'IPv4 внешнего сервера'=@{en='Remote server IPv4';'zh-CN'='远程服务器 IPv4'}
  'IPv4 VPS'=@{en='VPS IPv4';'zh-CN'='VPS IPv4'}
  'IPv4 Linux VPS'=@{en='Linux VPS IPv4';'zh-CN'='Linux VPS IPv4'}
  'SSH вход: 1 — Пароль; 2 — Приватный ключ'=@{en='SSH authentication: 1 — Password; 2 — Private key';'zh-CN'='SSH 登录：1 — 密码；2 — 私钥'}
  'Приватный ключ'=@{en='Private key';'zh-CN'='私钥'}
  'Файл приватного SSH ключа'=@{en='SSH private key file';'zh-CN'='SSH 私钥文件'}
  'Выбери существующий файл приватного SSH ключа.'=@{en='Choose an existing SSH private key file.';'zh-CN'='请选择现有的 SSH 私钥文件。'}
  'Файл приватного SSH ключа пуст или превышает 64 КБ.'=@{en='The SSH private key file is empty or exceeds 64 KB.';'zh-CN'='SSH 私钥文件为空或超过 64 KB。'}
  'Парольная фраза SSH ключа (необязательно; Enter — без неё)'=@{en='SSH key passphrase (optional; Enter — none)';'zh-CN'='SSH 密钥口令（可选；按 Enter 留空）'}
  'Парольная фраза SSH ключа превышает 1024 символа.'=@{en='The SSH key passphrase exceeds 1024 characters.';'zh-CN'='SSH 密钥口令超过 1024 个字符。'}
  'Выбрать файл…'=@{en='Choose file…';'zh-CN'='选择文件…'}
  'Все файлы|*.*'=@{en='All files|*.*';'zh-CN'='所有文件|*.*'}
  'Сохранить новый приватный SSH ключ'=@{en='Save the new SSH private key';'zh-CN'='保存新的 SSH 私钥'}
  'Сохранить ключ…'=@{en='Save key…';'zh-CN'='保存密钥…'}
  'Можно создать SSH ключ для следующих подключений. Приватный ключ останется на этом ПК; на сервер добавится только публичный ключ. Ключ без парольной фразы; доступ к файлу только у твоего пользователя Windows. Первичный SSH доступ и проверка ключа сервера уже выполнены.'=@{en='You can create an SSH key for future connections. The private key stays on this PC; only the public key is added to the server. The key has no passphrase; only your Windows user can access its file. Initial SSH access and server key verification are already complete.';'zh-CN'='可以为后续连接创建 SSH 密钥。私钥保留在此电脑上，服务器仅添加公钥。密钥不设置口令，仅当前 Windows 用户可访问密钥文件。首次 SSH 登录和服务器密钥验证已完成。'}
  'Создать новый SSH ключ для этого сервера? да/нет'=@{en='Create a new SSH key for this server? yes/no';'zh-CN'='为此服务器创建新的 SSH 密钥？是/否'}
  'Новый SSH ключ сохранён, добавлен на сервер и проверен отдельным подключением. Сохрани файл ключа для следующих установок и обновлений.'=@{en='The new SSH key was saved, added to the server and verified with a separate connection. Keep the key file for future installations and updates.';'zh-CN'='新的 SSH 密钥已保存并添加到服务器，且已通过独立连接验证。请保留密钥文件以用于后续安装和更新。'}
  'Новый SSH ключ не подтверждён. Сохранённый файл оставлен на ПК; установка продолжится с прежним SSH доступом. Можно повторить добавление позже из студии.'=@{en='The new SSH key could not be verified. Any saved file remains on this PC; installation will continue with the previous SSH access. You can retry adding a key later in the studio.';'zh-CN'='无法验证新的 SSH 密钥。已保存的文件保留在此电脑上；安装将继续使用原有 SSH 登录方式。稍后可在演播室中重试添加密钥。'}
  'Не удалось подготовить SSH вход. Проверь пароль либо приватный ключ и парольную фразу.'=@{en='Could not initialize SSH authentication. Check the password or private key and passphrase.';'zh-CN'='无法初始化 SSH 身份验证。请检查密码或私钥及密钥口令。'}
  'Не удалось сохранить новый SSH ключ. Выбери новый файл в существующей доступной для записи папке.'=@{en='Could not save a new SSH key. Choose a new file in an existing writable folder.';'zh-CN'='无法保存新的 SSH 密钥。请在现有可写文件夹中选择新文件。'}
  'Выбери пароль либо существующий файл приватного ключа.'=@{en='Choose either a password or an existing private key file.';'zh-CN'='请选择密码或现有的私钥文件。'}
  'SSH логин'=@{en='SSH username';'zh-CN'='SSH 用户名'}
  'SSH порт'=@{en='SSH port';'zh-CN'='SSH 端口'}
  'SSH пароль (не сохраняется)'=@{en='SSH password (not saved)';'zh-CN'='SSH 密码（不保存）'}
  'SSH пароль'=@{en='SSH password';'zh-CN'='SSH 密码'}
  'Для подтверждения введи: DELETE'=@{en='Type DELETE to confirm';'zh-CN'='输入 DELETE 以确认'}
  'Выбери номер установки; 0 — отмена'=@{en='Select the installation number; 0 — cancel';'zh-CN'='选择安装编号；0 — 取消'}
  'Выбери номер сервера для обновления; 0 — другая папка / новая установка'=@{en='Select the server to update; 0 — another folder / new installation';'zh-CN'='选择要更新的服务器；0 — 其他文件夹 / 新安装'}
  'Выбери номер сервера для удаления; 0 — другая папка / новая установка'=@{en='Select the server to remove; 0 — another folder / new installation';'zh-CN'='选择要卸载的服务器；0 — 其他文件夹 / 新安装'}
  'другая папка / новая установка'=@{en='Another folder / new installation';'zh-CN'='其他文件夹 / 新安装'}
  '1 — удалить сервер, сохранив комнаты и настройки; 2 — удалить сервер вместе с комнатами и настройками'=@{en='1 — remove the server, keep rooms and settings; 2 — remove the server, rooms and settings';'zh-CN'='1 — 卸载服务器并保留房间和设置；2 — 卸载服务器及其房间和设置'}
  'удалить сервер, сохранив комнаты и настройки'=@{en='Remove server, keep rooms and settings';'zh-CN'='卸载服务器并保留房间和设置'}
  'удалить сервер вместе с комнатами и настройками'=@{en='Remove server, rooms and settings';'zh-CN'='卸载服务器及其房间和设置'}
  'Доступ: 1 — LAN, другие устройства этой сети; 2 — публичный IPv4 через роутер'=@{en='Access: 1 — LAN, other devices on this network; 2 — public IPv4 through a router';'zh-CN'='访问：1 — 局域网内的其他设备；2 — 通过路由器使用公网 IPv4'}
  'LAN, другие устройства этой сети'=@{en='LAN, other devices on this network';'zh-CN'='局域网内的其他设备'}
  'публичный IPv4 через роутер'=@{en='Public IPv4 through a router';'zh-CN'='通过路由器使用公网 IPv4'}
  'IPv4 для CastLink (можно изменить)'=@{en='CastLink IPv4 (can be changed)';'zh-CN'='CastLink IPv4（可修改）'}
  'Домен (Enter — сохранить прежний домен)'=@{en='Domain (Enter — keep the existing domain)';'zh-CN'='域名（按 Enter 保留原域名）'}
  'Домен (необязательно; Enter — доступ по IP)'=@{en='Domain (optional; Enter — access by IP)';'zh-CN'='域名（可选；按 Enter 通过 IP 访问）'}
  'Отдельный домен TURN/TLS (необязательно; Enter — пропустить)'=@{en='Separate TURN/TLS domain (optional; Enter — skip)';'zh-CN'='独立的 TURN/TLS 域名（可选；按 Enter 跳过）'}
  'Нажми Enter после изменения DNS, чтобы проверить снова (Ctrl+C — выход)'=@{en='Press Enter after changing DNS to check again (Ctrl+C — exit)';'zh-CN'='修改 DNS 后按 Enter 重新检查（Ctrl+C — 退出）'}
  'Для SSH нужен .NET Framework 4.8. Скачать и установить официальный компонент Microsoft?'=@{en='SSH requires .NET Framework 4.8. Download and install the official Microsoft component?';'zh-CN'='SSH 需要 .NET Framework 4.8。是否下载并安装 Microsoft 官方组件？'}
  'Установить Docker Desktop и принять условия установки?'=@{en='Install Docker Desktop and accept its installation terms?';'zh-CN'='安装 Docker Desktop 并接受其安装条款？'}
  'Остановить службы этой установки, сохранив комнаты и настройки?'=@{en='Stop this installation''s services, keeping rooms and settings?';'zh-CN'='停止此安装的服务并保留房间和设置？'}
  'Добавить сертификат этого CastLink в доверенные для твоего пользователя Windows? да/нет'=@{en='Trust this CastLink certificate for your Windows user? yes/no';'zh-CN'='为当前 Windows 用户信任此 CastLink 证书？是/否'}
  'Добавить сертификат? да/нет'=@{en='Trust the certificate? yes/no';'zh-CN'='信任此证书？是/否'}
  'Добавить ещё один резервный сервер сейчас? да/нет (можно позже из студии)'=@{en='Add another reserve server now? yes/no (you can do this later in the studio)';'zh-CN'='现在添加另一台备用服务器？是/否（也可稍后在演播室中添加）'}
  'Резерв: 1 — Установить CastLink на пустой VPS; 2 — Подключить установленный CastLink'=@{en='Reserve: 1 — install CastLink on an empty VPS; 2 — connect an existing CastLink server';'zh-CN'='备用服务器：1 — 在空 VPS 上安装 CastLink；2 — 连接已安装的 CastLink'}
  'Установить CastLink на пустой VPS'=@{en='Install CastLink on an empty VPS';'zh-CN'='在空 VPS 上安装 CastLink'}
  'Подключить установленный CastLink'=@{en='Connect an existing CastLink server';'zh-CN'='连接已安装的 CastLink'}
  'Публичный IPv4 резервного VPS'=@{en='Reserve VPS public IPv4';'zh-CN'='备用 VPS 的公网 IPv4'}
  'SSH порт резервного VPS'=@{en='Reserve VPS SSH port';'zh-CN'='备用 VPS 的 SSH 端口'}
  'Название резервного сервера'=@{en='Reserve server name';'zh-CN'='备用服务器名称'}
  'Root SSH пароль резервного VPS (не сохраняется)'=@{en='Reserve VPS root SSH password (not saved)';'zh-CN'='备用 VPS 的 root SSH 密码（不保存）'}
  'Подключение резервного CastLink'=@{en='Connecting the reserve CastLink server';'zh-CN'='正在连接备用 CastLink 服务器'}
  'Выбор сервера и подтверждение удаления'=@{en='Server selection and removal confirmation';'zh-CN'='选择服务器并确认卸载'}
  'Остановка выбранного сервера'=@{en='Stopping the selected server';'zh-CN'='正在停止所选服务器'}
  'Очистка собственных ресурсов'=@{en='Cleaning this installation''s resources';'zh-CN'='正在清理此安装的资源'}
  'Службы удалены; очистка файлов после закрытия мастера'=@{en='Services removed; files will be cleaned after the wizard closes';'zh-CN'='服务已卸载；关闭向导后将清理文件'}
  'Удаление выбранного сервера завершено'=@{en='Selected server removal completed';'zh-CN'='所选服务器已卸载'}
  'Очистка файлов после закрытия мастера'=@{en='File cleanup after the wizard closes';'zh-CN'='关闭向导后清理文件'}
  'Подготовка среды'=@{en='Preparing the environment';'zh-CN'='正在准备环境'}
  'Загрузка текущего выпуска'=@{en='Downloading the current release';'zh-CN'='正在下载当前版本'}
  'Развёртывание приложения и базы'=@{en='Deploying the application and database';'zh-CN'='正在部署应用和数据库'}
  'Проверка HTTPS и готовности'=@{en='Checking HTTPS and readiness';'zh-CN'='正在检查 HTTPS 和就绪状态'}
  'Установка завершена'=@{en='Installation completed';'zh-CN'='安装完成'}
  'Контрольные суммы GitHub'=@{en='GitHub checksums';'zh-CN'='GitHub 校验和'}
  'Windows пакет CastLink'=@{en='CastLink Windows package';'zh-CN'='CastLink Windows 安装包'}
  'Linux пакет CastLink'=@{en='CastLink Linux package';'zh-CN'='CastLink Linux 安装包'}
  'Для локального сервера нужен Docker Desktop. Для установки могут понадобиться права администратора и перезагрузка.'=@{en='A local server needs Docker Desktop. Installation may require administrator permission and a restart.';'zh-CN'='本机服务器需要 Docker Desktop。安装可能需要管理员权限和重启。'}
  'Условия Docker Desktop: https://www.docker.com/legal/docker-subscription-service-agreement/'=@{en='Docker Desktop terms: https://www.docker.com/legal/docker-subscription-service-agreement/';'zh-CN'='Docker Desktop 条款：https://www.docker.com/legal/docker-subscription-service-agreement/'}
  'Подготавливаю WSL2. Windows может запросить права администратора и перезагрузку.'=@{en='Preparing WSL2. Windows may request administrator permission and a restart.';'zh-CN'='正在准备 WSL2。Windows 可能会请求管理员权限和重启。'}
  'Docker с Linux containers уже готов.'=@{en='Docker with Linux containers is already ready.';'zh-CN'='支持 Linux 容器的 Docker 已就绪。'}
  'Запускаю Docker Desktop...'=@{en='Starting Docker Desktop...';'zh-CN'='正在启动 Docker Desktop...'}
  'Ожидаю готовности Docker. Если появится окно Docker, заверши его первоначальную настройку.'=@{en='Waiting for Docker. If its window appears, complete the initial setup.';'zh-CN'='正在等待 Docker 就绪。如出现 Docker 窗口，请完成初始设置。'}
  'Docker с Linux containers готов. Продолжаю установку CastLink.'=@{en='Docker with Linux containers is ready. Continuing CastLink setup.';'zh-CN'='支持 Linux 容器的 Docker 已就绪。正在继续安装 CastLink。'}
  'Перезагрузи Windows для завершения уже выполненной подготовки Docker/WSL.'=@{en='Restart Windows to complete the Docker/WSL preparation.';'zh-CN'='请重启 Windows 以完成 Docker/WSL 准备。'}
  'Подготавливаю базу данных...'=@{en='Preparing the database...';'zh-CN'='正在准备数据库...'}
  'Службы только выбранного сервера будут остановлены. Данные сохраняются по умолчанию.'=@{en='Only the selected server''s services will stop. Data is kept by default.';'zh-CN'='仅停止所选服务器的服务。默认保留数据。'}
  'Комнаты, записи и настройки этой установки будут удалены без восстановления. Собственные загрузки и неиспользуемые компоненты будут очищены; чужие и общие сохранятся.'=@{en='This installation''s rooms, recordings and settings will be permanently deleted. Its downloads and unused components will be cleaned; other and shared components are retained.';'zh-CN'='此安装的房间、录像和设置将永久删除。其下载文件和未使用的组件将被清理；其他安装及共享组件会保留。'}
  'Для локальной сети выбери LAN адрес. Для доступа извне укажи публичный IPv4 и настрой проброс портов на роутере.'=@{en='Choose a LAN address for local network access. For external access, enter a public IPv4 and configure router port forwarding.';'zh-CN'='在局域网内访问请选择局域网地址。从外部访问需输入公网 IPv4 并配置路由器端口转发。'}
  'Обнаруженный внешний адрес может принадлежать NAT провайдера. Для внешнего доступа нужен собственный публичный адрес и доступные входящие порты.'=@{en='The detected external address may belong to your provider''s NAT. External access requires your own public address and accessible incoming ports.';'zh-CN'='检测到的外部地址可能属于运营商 NAT。外部访问需要独立公网地址及可访问的入站端口。'}
  'Каталог CastLink на внешнем сервере мастер создаст автоматически.'=@{en='The wizard will create the CastLink folder on the remote server automatically.';'zh-CN'='向导将自动在远程服务器上创建 CastLink 文件夹。'}
  'Локальный сервер'=@{en='Local server';'zh-CN'='本机服务器'}
  'Проверяю службы…'=@{en='Checking services…';'zh-CN'='正在检查服务…'}
  'Службы'=@{en='Services';'zh-CN'='服务'}
  'Docker Desktop: проверка…'=@{en='Docker Desktop: checking…';'zh-CN'='Docker Desktop：正在检查…'}
  'Запустить службы'=@{en='Start services';'zh-CN'='启动服务'}
  'Обновить статус'=@{en='Refresh status';'zh-CN'='刷新状态'}
  'Автозапуск — после входа в Windows. Docker Desktop должен подготовить Linux containers. Статус контейнеров не заменяет проверку сайта.'=@{en='Autostart runs after Windows sign-in. Docker Desktop must prepare Linux containers. Container status does not replace checking the website.';'zh-CN'='登录 Windows 后自动启动。Docker Desktop 必须准备好 Linux 容器。容器状态不能代替网站检查。'}
  'Не запущен'=@{en='Not running';'zh-CN'='未运行'}
  'Не найден'=@{en='Not found';'zh-CN'='未找到'}
  'Ожидание Docker Desktop'=@{en='Waiting for Docker Desktop';'zh-CN'='正在等待 Docker Desktop'}
  'Ожидание служб'=@{en='Waiting for services';'zh-CN'='正在等待服务'}
  'Linux containers готовы'=@{en='Linux containers ready';'zh-CN'='Linux 容器已就绪'}
  'Доступен по HTTPS'=@{en='Available via HTTPS';'zh-CN'='可通过 HTTPS 访问'}
  'HTTPS пока не готов'=@{en='HTTPS not ready yet';'zh-CN'='HTTPS 尚未就绪'}
  'Сертификат HTTPS не доверен'=@{en='HTTPS certificate not trusted';'zh-CN'='HTTPS 证书尚未受信任'}
  'HTTPS недоступен'=@{en='HTTPS unavailable';'zh-CN'='HTTPS 不可用'}
  'Службы удалены, данные сохранены'=@{en='Services removed, data retained';'zh-CN'='服务已卸载，数据已保留'}
  'CastLink доступен'=@{en='CastLink available';'zh-CN'='CastLink 可用'}
  'Контейнеры запущены; HTTPS не готов'=@{en='Containers running; HTTPS not ready';'zh-CN'='容器正在运行；HTTPS 尚未就绪'}
  'Часть служб не работает'=@{en='Some services are not running';'zh-CN'='部分服务未运行'}
  'База данных'=@{en='Database';'zh-CN'='数据库'}
  'Приложение'=@{en='Application';'zh-CN'='应用'}
  'Медиа'=@{en='Media';'zh-CN'='媒体'}
  'HTTPS-прокси'=@{en='HTTPS proxy';'zh-CN'='HTTPS 代理'}
  'работает'=@{en='Running';'zh-CN'='运行中'}
  'перезапускается'=@{en='Restarting';'zh-CN'='正在重启'}
  'приостановлен'=@{en='Paused';'zh-CN'='已暂停'}
  'остановлен'=@{en='Stopped';'zh-CN'='已停止'}
  'создан'=@{en='Created';'zh-CN'='已创建'}
  'удаляется'=@{en='Removing';'zh-CN'='正在删除'}
  'ошибка'=@{en='Error';'zh-CN'='错误'}
  'Запускаю Docker Desktop и службы. Это может занять до 2 минут.'=@{en='Starting Docker Desktop and services. This can take up to 2 minutes.';'zh-CN'='正在启动 Docker Desktop 和服务。最多可能需要 2 分钟。'}
  'Требуется проверка'=@{en='Check required';'zh-CN'='需要检查'}
  'Проверь Docker Desktop и сохранённую установку. Если службы удалены, восстанови их через Easy Setup с той же папкой.'=@{en='Check Docker Desktop and the saved installation. If services were removed, restore them using Easy Setup with the same folder.';'zh-CN'='请检查 Docker Desktop 和已保存的安装。如服务已卸载，请使用 Easy Setup 和同一文件夹恢复。'}
  'Запуск служб выполнен. Готовность HTTPS проверь на главной странице.'=@{en='Services have been started. Check HTTPS readiness on the main page.';'zh-CN'='服务启动操作已完成。请在主页检查 HTTPS 就绪状态。'}
  'Начать'=@{en='Start';'zh-CN'='开始'}
  'Выбранный язык'=@{en='Selected language';'zh-CN'='已选择的语言'}
  'Выбери язык и начни установку'=@{en='Choose a language and start setup';'zh-CN'='选择语言并开始安装'}
  'Добро пожаловать в CastLink'=@{en='Welcome to CastLink';'zh-CN'='欢迎使用 CastLink'}
  'Выбери язык интерфейса и нажми «Начать». Мастер поможет установить, обновить или удалить CastLink.'=@{en='Choose an interface language and click Start. The wizard will help you install, update or remove CastLink.';'zh-CN'='选择界面语言并点击“开始”。向导将帮助您安装、更新或卸载 CastLink。'}
  'Комнаты и настройки выбранной установки будут удалены без восстановления.'=@{en='This installation''s rooms and settings will be permanently deleted.';'zh-CN'='此安装的房间和设置将永久删除，无法恢复。'}
  'Проверка Ubuntu и Docker'=@{en='Checking Ubuntu and Docker';'zh-CN'='正在检查 Ubuntu 和 Docker'}
  'Загрузка серверных компонентов'=@{en='Downloading server components';'zh-CN'='正在下载服务器组件'}
  'Запуск CastLink'=@{en='Starting CastLink';'zh-CN'='正在启动 CastLink'}
  'Подготовка базы'=@{en='Preparing the database';'zh-CN'='正在准备数据库'}
  'Проверка HTTPS'=@{en='Checking HTTPS';'zh-CN'='正在检查 HTTPS'}
  'Подключение серверов'=@{en='Connecting servers';'zh-CN'='正在连接服务器'}
  'этот ПК'=@{en='this PC';'zh-CN'='此电脑'}
  'Найдены установки CastLink:'=@{en='CastLink installations found:';'zh-CN'='找到以下 CastLink 安装：'}
  'Найдены установки CastLink на внешнем сервере:'=@{en='CastLink installations found on the remote server:';'zh-CN'='在远程服务器上找到以下 CastLink 安装：'}
  'Дополнительно можно включить TURN/TLS на TCP 443 для корпоративных сетей и VPN. Нужен отдельный домен с A-записью на этот VPS. Enter сохраняет обычный режим с TURN/UDP.'=@{en='You can enable TURN/TLS on TCP 443 for corporate networks and VPNs. A separate domain with an A record pointing to this VPS is required. Enter keeps the standard TURN/UDP mode.';'zh-CN'='可为企业网络和 VPN 启用 TCP 443 上的 TURN/TLS。需要一个独立域名，其 A 记录指向此 VPS。按 Enter 保留标准 TURN/UDP 模式。'}
  'Не удалось открыть управление CastLink. Проверь сохранённую папку установки и Docker Desktop. Данные не изменены.'=@{en='Could not open CastLink controls. Check the saved installation folder and Docker Desktop. Data has not changed.';'zh-CN'='无法打开 CastLink 管理窗口。请检查已保存的安装文件夹和 Docker Desktop。数据未更改。'}
  'Скрыть в трей'=@{en='Hide to tray';'zh-CN'='隐藏到系统托盘'}
  'Открыть панель'=@{en='Open panel';'zh-CN'='打开面板'}
  'Выход'=@{en='Exit';'zh-CN'='退出'}
  'Останавливаю службы CastLink. Данные сохраняются.'=@{en='Stopping CastLink services. Data is retained.';'zh-CN'='正在停止 CastLink 服务。数据将保留。'}
  'Не удалось остановить службы'=@{en='Could not stop services';'zh-CN'='无法停止服务'}
  'Проверь Docker Desktop и повтори остановку служб. Данные сохранены; панель остаётся открытой.'=@{en='Check Docker Desktop and try stopping services again. Data is retained; the panel stays open.';'zh-CN'='请检查 Docker Desktop，然后重试停止服务。数据已保留；面板保持打开。'}
  'Ожидаю завершения текущей операции перед остановкой служб.'=@{en='Waiting for the current operation to finish before stopping services.';'zh-CN'='正在等待当前操作完成，然后停止服务。'}
  'Закрытие окна скрывает панель в трей; службы продолжают работать. Кнопка «Остановить службы» останавливает только этот CastLink; данные сохраняются.'=@{en='Closing the window hides the panel to the tray; services keep running. Stop services stops only this CastLink installation; data is retained.';'zh-CN'='关闭窗口会将面板隐藏到系统托盘；服务继续运行。“停止服务”仅停止此 CastLink 安装的服务；数据将保留。'}
  'Остановить службы'=@{en='Stop services';'zh-CN'='停止服务'}
  'Остановить и выйти'=@{en='Stop and exit';'zh-CN'='停止并退出'}
  'Открываю панель CastLink…'=@{en='Opening the CastLink panel…';'zh-CN'='正在打开 CastLink 面板…'}
  'Установка завершена; панель не открылась'=@{en='Installation completed; panel did not open';'zh-CN'='安装已完成；面板未打开'}
  'Службы продолжают работать. Повтори открытие панели кнопкой ниже или через ярлык CastLink. Данные сохранены.'=@{en='Services keep running. Try opening the panel again with the button below or the CastLink shortcut. Data is retained.';'zh-CN'='服务继续运行。请使用下方按钮或 CastLink 快捷方式重试打开面板。数据已保留。'}
  'Службы CastLink остановлены. Данные сохранены.'=@{en='CastLink services stopped. Data retained.';'zh-CN'='CastLink 服务已停止。数据已保留。'}
  'Панель этой установки уже открыта. Найди CastLink в трее.'=@{en='This installation''s panel is already open. Find CastLink in the tray.';'zh-CN'='此安装的面板已打开。请在系统托盘中找到 CastLink。'}
  'Открыть панель CastLink'=@{en='Open CastLink panel';'zh-CN'='打开 CastLink 面板'}
  'Установка завершена; службы работают'=@{en='Installation completed; services running';'zh-CN'='安装已完成；服务正在运行'}
  'Установка завершена; сертификат HTTPS не доверен'=@{en='Installation completed; HTTPS certificate not trusted';'zh-CN'='安装已完成；HTTPS 证书尚未受信任'}
  'Открываю панель CastLink. Закрытие окна панели скрывает её в трей; службы продолжают работать. Кнопка «Остановить службы» сохраняет данные. Адрес сервера можно скопировать ниже.'=@{en='Opening the CastLink panel. Closing its window hides it to the tray; services keep running. Stop services retains your data. You can copy the server address below.';'zh-CN'='正在打开 CastLink 面板。关闭其窗口会将面板隐藏到系统托盘；服务继续运行。“停止服务”保留您的数据。您可以在下方复制服务器地址。'}
  'Не удалось проверить панель этой установки. Открой её через ярлык CastLink или проверь сохранённую папку.'=@{en='Could not verify this installation''s panel. Open it using the CastLink shortcut or check the saved folder.';'zh-CN'='无法验证此安装的面板。请使用 CastLink 快捷方式打开面板，或检查已保存的文件夹。'}
  'Не удалось открыть панель CastLink. Проверь сохранённую папку установки и повтори попытку.'=@{en='Could not open the CastLink panel. Check the saved installation folder and try again.';'zh-CN'='无法打开 CastLink 面板。请检查已保存的安装文件夹，然后重试。'}
  'Перед обновлением или удалением выбери «Остановить и выйти» в трее CastLink и дождись остановки служб. Закрытие окна только скрывает панель в трей.'=@{en='Before updating or removing this installation, choose Stop and exit in the CastLink tray menu and wait for services to stop. Closing the window only hides the panel to the tray.';'zh-CN'='更新或卸载此安装前，请在 CastLink 托盘菜单中选择“停止并退出”，然后等待服务停止。关闭窗口只会将面板隐藏到托盘。'}
  'Установка остановлена: Перед обновлением или удалением выбери «Остановить и выйти» в трее CastLink и дождись остановки служб. Закрытие окна только скрывает панель в трей.'=@{en='Setup stopped: Before updating or removing this installation, choose Stop and exit in the CastLink tray menu and wait for services to stop. Closing the window only hides the panel to the tray.';'zh-CN'='安装已停止：更新或卸载此安装前，请在 CastLink 托盘菜单中选择“停止并退出”，然后等待服务停止。关闭窗口只会将面板隐藏到托盘。'}
}
function Format-SimpleBuildText([object]$Metadata,[string]$Language='ru') {
  $commit=[string]$Metadata.commit;$version=[string]$Metadata.version
  $knownBuild=$commit -cmatch '^[a-f0-9]{40}$'
  $knownVersion=$knownBuild -and $version.Length -le 128 -and $version -cmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$'
  $text=if($knownVersion){(Get-SimpleGuiText 'Версия {0}' $Language) -f $version}else{Get-SimpleGuiText 'Версия неизвестна' $Language}
  if($knownBuild){$text+=' · '+((Get-SimpleGuiText 'Сборка {0}' $Language) -f $commit.Substring(0,6))}
  return $text
}
function Get-SimpleGuiLanguage([string]$PreferencePath='HKCU:\Software\CastLink\EasySetup') {
  try{$value=[string](Get-ItemProperty -LiteralPath $PreferencePath -Name Language -ErrorAction Stop).Language;if($value -cin @('ru','en','zh-CN')){return $value}}catch{}
  return 'ru'
}
function Set-SimpleGuiLanguage {
  param([ValidateSet('ru','en','zh-CN')][string]$Language,[string]$PreferencePath='HKCU:\Software\CastLink\EasySetup')
  try{$null=New-Item -Path $PreferencePath -Force -ErrorAction Stop;$null=New-ItemProperty -LiteralPath $PreferencePath -Name Language -Value $Language -PropertyType String -Force -ErrorAction Stop;return $true}catch{return $false}
}
function Get-SimpleGuiText([string]$Key,[string]$Language='ru') {return (ConvertTo-SimpleGuiText -Text $Key -Language $Language)}
function ConvertTo-SimpleGuiText([string]$Text,[string]$Language='ru') {
  if($Language -notin @('en','zh-CN') -or -not $Text){return $Text}
  if($script:SimpleGuiTranslations.ContainsKey($Text)){return [string]$script:SimpleGuiTranslations[$Text][$Language]}
  if($Text.Contains("`n")){return (($Text -split '\r?\n'|ForEach-Object{ConvertTo-SimpleGuiText $_ $Language}) -join "`n")}
  if($Text -match '^Этап (\d+)/(\d+) — (.+)$'){
    $m=$matches;$name=ConvertTo-SimpleGuiText $m[3] $Language
    if($Language -eq 'en'){return ('Step {0}/{1} — {2}' -f $m[1],$m[2],$name)}
    return ('步骤 {0}/{1} — {2}' -f $m[1],$m[2],$name)
  }
  if($Text -match '^([0-9.,]+) МБ(?: / ([0-9.,]+) МБ)? · ([0-9.,]+) МБ/с$'){
    $m=$matches;$amount=$m[1]+' MB';if($m[2]){$amount+=' / '+$m[2]+' MB'}
    if($Language -eq 'en'){return ($amount+' · '+$m[3]+' MB/s')};return ($amount+' · '+$m[3]+' MB/秒')
  }
  if($Text -match '^SSH (.+) fingerprint (.+)\. (?:Trust this server\? Type yes|Сверь ключ с VPS и введи yes, чтобы доверять серверу)$'){
    $m=$matches
    if($Language -eq 'en'){return ('SSH {0} fingerprint {1}. Compare the key with your VPS and type yes to trust this server' -f $m[1],$m[2])}
    return ('SSH {0} 指纹 {1}。请与 VPS 的密钥核对，输入 yes 以信任此服务器' -f $m[1],$m[2])
  }
  if($Text -match '^(.+) · ([0-9.,]+) МБ(?: · ([0-9.,]+) МБ/с)?$'){
    $m=$matches;$name=ConvertTo-SimpleGuiText $m[1] $Language;$text=$name+' · '+$m[2]+' MB'
    if($m[3]){$text+=' · '+$m[3]+$(if($Language -eq 'en'){' MB/s'}else{' MB/秒'})};return $text
  }
  foreach($template in @(
    @{pattern='^Порты сайта: TCP (.+); медиапорты: TCP (\d+), UDP (\d+),(\d+),(\d+)-(\d+)\.$';en='Site ports: TCP {0}; media ports: TCP {1}, UDP {2},{3},{4}-{5}.';'zh-CN'='网站端口：TCP {0}；媒体端口：TCP {1}，UDP {2},{3},{4}-{5}。'},
    @{pattern='^CastLink установлен: (https?://.+)$';en='CastLink installed: {0}';'zh-CN'='CastLink 已安装：{0}'},
    @{pattern='^Выбран сервер (.+), папка (.+)$';en='Selected server {0}, folder {1}';'zh-CN'='所选服务器 {0}，文件夹 {1}'},
    @{pattern='^Удаление CastLink: (.+), сервер: этот ПК, папка: (.+)$';en='Removing CastLink: {0}, server: this PC, folder: {1}';'zh-CN'='正在卸载 CastLink：{0}，服务器：此电脑，文件夹：{1}'},
    @{pattern='^Адреса этого ПК: (.+)$';en='This PC addresses: {0}';'zh-CN'='此电脑的地址：{0}'},
    @{pattern='^Прежняя установка: (.+)$';en='Previous installation: {0}';'zh-CN'='原有安装：{0}'},
    @{pattern='^Продолжаю сохранённую установку: (.+)$';en='Continuing saved installation: {0}';'zh-CN'='正在继续已保存的安装：{0}'},
    @{pattern='^Данные мастера на этом ПК сохраняются автоматически: (.+)$';en='Wizard data is saved automatically on this PC: {0}';'zh-CN'='向导数据自动保存在此电脑上：{0}'},
    @{pattern='^Папка CastLink на внешнем сервере: (.+)$';en='CastLink folder on the remote server: {0}';'zh-CN'='远程服务器上的 CastLink 文件夹：{0}'},
    @{pattern='^Удаление CastLink: (.+), сервер: (.+), папка: (.+)$';en='Removing CastLink: {0}, server: {1}, folder: {2}';'zh-CN'='正在卸载 CastLink：{0}，服务器：{1}，文件夹：{2}'},
    @{pattern='^Устанавливаю CastLink (.+)$';en='Installing CastLink {0}';'zh-CN'='正在安装 CastLink {0}'}
  )){
    if($Text -match $template.pattern){$m=$matches;return ($template[$Language] -f $m[1],$m[2],$m[3],$m[4],$m[5],$m[6])}
  }
  # Unrecognised strings, URLs, paths and user-provided labels remain byte-for-byte text.
  return $Text
}
function Get-SimpleGuiContext([string[]]$Lines,[string]$Language='ru') {
  if($Language -eq 'ru'){return ($Lines -join "`n")}
  $result=New-Object 'Collections.Generic.List[string]';$technical=$false
  foreach($line in $Lines){
    $translated=ConvertTo-SimpleGuiText $line $Language
    if($translated -cne $line){$result.Add($translated)}elseif($line){$result.Add($line);$technical=$true}
  }
  if($technical){$result.Add((Get-SimpleGuiText 'Технические сообщения показаны в подробностях выполнения на исходном языке.' $Language))}
  return ($result.ToArray() -join "`n")
}
