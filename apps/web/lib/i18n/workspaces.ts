import type { Translator } from "@/lib/i18n";

export const workspacesMessages: Record<string, readonly [string, string]> = {
  "Во весь экран": [
    "Full screen",
    "全屏"
  ],
  "Не удалось загрузить комнаты": [
    "Could not load rooms",
    "无法加载房间"
  ],
  "Не удалось получить список серверов.": [
    "Could not retrieve the server list.",
    "无法获取服务器列表。"
  ],
  "Список серверов временно недоступен.": [
    "The server list is temporarily unavailable.",
    "服务器列表暂时不可用。"
  ],
  "Комната перенесена. Устройства браузера нужно подтвердить на этом сервере; публикация пока выключена.": [
    "Room transferred. Confirm browser devices on this server; publishing is currently off.",
    "房间已转移。请在此服务器上确认浏览器设备；目前尚未发布。"
  ],
  "Дождитесь подтверждения подключения основной студии, затем повторите перенос.": [
    "Wait for the primary studio connection to be confirmed, then retry the transfer.",
    "请等待主导播台确认连接，然后重试转移。"
  ],
  "Не удалось начать перенос комнаты.": [
    "Could not start the room transfer.",
    "无法开始转移房间。"
  ],
  "Подготовлен перенос комнаты. Участники переподключатся на целевом сервере.": [
    "Room transfer prepared. Participants will reconnect on the target server.",
    "房间转移已准备就绪。参与者将在目标服务器上重新连接。"
  ],
  "Не удалось перенести комнату. Текущая сессия продолжает работать.": [
    "Could not transfer the room. The current session continues to work.",
    "无法转移房间。当前会话仍在运行。"
  ],
  "Ошибка изменения комнаты": [
    "Could not update the room",
    "无法更新房间"
  ],
  "Не удалось обновить список комнат": [
    "Could not refresh the room list",
    "无法刷新房间列表"
  ],
  "Ошибка создания": [
    "Could not create the room",
    "无法创建房间"
  ],
  "Не удалось изменить настройки комнаты": [
    "Could not change room settings",
    "无法更改房间设置"
  ],
  "Удалить комнату «{roomName}» из списка Studio?": [
    "Remove room “{roomName}” from the Studio list?",
    "从导播台列表中移除房间“{roomName}”？"
  ],
  "Ошибка удаления": [
    "Could not delete the room",
    "无法删除房间"
  ],
  "Отключить «{name}» от комнаты? Участник сможет войти снова.": [
    "Disconnect “{name}” from the room? They will be able to join again.",
    "将“{name}”移出房间？该参与者可以再次加入。"
  ],
  "Не удалось отключить участника": [
    "Could not disconnect the participant",
    "无法断开参与者的连接"
  ],
  "Ошибка отключения": [
    "Disconnection failed",
    "断开连接失败"
  ],
  "Подключение…": [
    "Connecting…",
    "正在连接…"
  ],
  "ожидание": [
    "waiting",
    "等待中"
  ],
  "Ожидание нового замера исходящего потока основной студии": [
    "Waiting for a new measurement of the primary studio outgoing stream",
    "正在等待主导播台出站流的新测量数据"
  ],
  "ON AIR={current}; публикация выключена": [
    "ON AIR={current}; publishing is off",
    "ON AIR={current}；发布已关闭"
  ],
  "Плохая": [
    "Poor",
    "差"
  ],
  "Средняя": [
    "Fair",
    "一般"
  ],
  "Хорошая": [
    "Good",
    "良好"
  ],
  "Не удалось снять замер: {value0}": [
    "Could not measure: {value0}",
    "无法测量：{value0}"
  ],
  "ошибка WebRTC": [
    "WebRTC error",
    "WebRTC 错误"
  ],
  "Не удалось определить роль Studio Panel": [
    "Could not determine the Studio Panel role",
    "无法确定导播台角色"
  ],
  "Не удалось передать настройки переноса основной студии": [
    "Could not send primary studio transfer settings",
    "无法发送主导播台的转移设置"
  ],
  "Онлайн": [
    "Online",
    "在线"
  ],
  "Ошибка подключения": [
    "Connection error",
    "连接错误"
  ],
  "нет publications": [
    "no publications",
    "无发布流"
  ],
  "Источник не поддерживает 1920×1080. Выберите Full HD камеру или настройте выход источника на 1920×1080.": [
    "The source does not support 1920×1080. Choose a Full HD camera or set the source output to 1920×1080.",
    "此来源不支持 1920×1080。请选择全高清摄像头，或将来源输出设置为 1920×1080。"
  ],
  "Не удалось открыть устройства Studio Return": [
    "Could not open Studio Return devices",
    "无法打开 Studio Return 设备"
  ],
  "Дождитесь сохранения видеокодека и режима потока": [
    "Wait for the video codec and stream mode to be saved",
    "请等待视频编解码器和流模式保存完成"
  ],
  "Дождитесь готовности выбранных устройств Studio Return": [
    "Wait for the selected Studio Return devices to be ready",
    "请等待所选 Studio Return 设备就绪"
  ],
  "Дождитесь готовности предпросмотра Studio Return": [
    "Wait for the Studio Return preview to be ready",
    "请等待 Studio Return 预览就绪"
  ],
  "Нет видео или аудио Studio Return": [
    "Studio Return video or audio is missing",
    "缺少 Studio Return 视频或音频"
  ],
  "Ошибка публикации": [
    "Publishing error",
    "发布错误"
  ],
  "Не найден опубликованный видеопоток Studio Return": [
    "Published Studio Return video stream not found",
    "找不到已发布的 Studio Return 视频流"
  ],
  "LiveKit не предоставил RTCRtpSender для Studio Return": [
    "LiveKit did not provide an RTCRtpSender for Studio Return",
    "LiveKit 未为 Studio Return 提供 RTCRtpSender"
  ],
  "Не удалось повторно применить лимиты видеокодировщика": [
    "Could not reapply video encoder limits",
    "无法重新应用视频编码器限制"
  ],
  "Studio Panel ещё подключается": [
    "Studio Panel is still connecting",
    "导播台仍在连接"
  ],
  "Не удалось отправить команду Studio Panel": [
    "Could not send the Studio Panel command",
    "无法发送导播台命令"
  ],
  "Ошибка общего управления": [
    "Shared control error",
    "共享控制错误"
  ],
  "Кодек и режим видеопотока меняются только в OFF AIR.": [
    "The video codec and stream mode can only be changed while OFF AIR.",
    "仅在 OFF AIR 状态下可更改视频编解码器和流模式。"
  ],
  "Не удалось изменить качество эфира": [
    "Could not change broadcast quality",
    "无法更改直播质量"
  ],
  "Для смены камеры или микрофона выключите эфир основной студии.": [
    "Turn off the primary studio broadcast to change its camera or microphone.",
    "请关闭主导播台直播后再更换摄像头或麦克风。"
  ],
  "Выбранное устройство отключено от основной студии. Обновите список и повторите выбор.": [
    "The selected device is disconnected from the primary studio. Refresh the list and select it again.",
    "所选设备已与主导播台断开连接。请刷新列表后重新选择。"
  ],
  "Браузер основной студии не поддерживает выбор динамиков.": [
    "The primary studio browser does not support speaker selection.",
    "主导播台的浏览器不支持选择扬声器。"
  ],
  "Не удалось выбрать устройство основной студии": [
    "Could not select a primary studio device",
    "无法选择主导播台设备"
  ],
  "Предпросмотр Studio Return не стал готов за отведённое время. Проверьте источник перед повторным включением эфира.": [
    "Studio Return preview did not become ready in time. Check the source before starting the broadcast again.",
    "Studio Return 预览未能及时就绪。请检查来源后再重新开始直播。"
  ],
  "Не удалось применить команду ON AIR. Проверьте устройства и повторите действие.": [
    "Could not apply the ON AIR command. Check devices and try again.",
    "无法执行 ON AIR 命令。请检查设备后重试。"
  ],
  "Не удалось применить команду эфира": [
    "Could not apply the broadcast command",
    "无法执行直播命令"
  ],
  "Не удалось проверить управление Studio Panel": [
    "Could not check Studio Panel control",
    "无法检查导播台控制权限"
  ],
  "Ошибка связи с Studio Panel": [
    "Studio Panel communication error",
    "导播台通信错误"
  ],
  "Системный выход": [
    "System output",
    "系统输出"
  ],
  "Основная студия потеряла управление": [
    "The primary studio lost control",
    "主导播台失去控制权限"
  ],
  "Не удалось продлить управление": [
    "Could not renew control",
    "无法续期控制权限"
  ],
  "Не удалось включить эфир после подготовки предпросмотра.": [
    "Could not start the broadcast after preparing the preview.",
    "准备预览后无法开始直播。"
  ],
  " Выход звука выбран системный; при необходимости измените его вручную.": [
    " System audio output selected; change it manually if needed.",
    " 已选择系统音频输出；如有需要，请手动更改。"
  ],
  "Камера и микрофон найдены по точным названиям. Проверяем предпросмотр перед восстановлением эфира.{outputMessage}": [
    "Camera and microphone found by exact names. Checking the preview before restoring the broadcast.{outputMessage}",
    "已按完整名称找到摄像头和麦克风。正在检查预览，然后恢复直播。{outputMessage}"
  ],
  "Камера и микрофон найдены по точным названиям. Предпросмотр восстановлен; публикация выключена.{outputMessage}": [
    "Camera and microphone found by exact names. Preview restored; publishing is off.{outputMessage}",
    "已按完整名称找到摄像头和麦克风。预览已恢复；发布已关闭。{outputMessage}"
  ],
  "Камера и микрофон найдены по точным названиям. Выберите «Проверить Studio Return», когда будете готовы.{outputMessage}": [
    "Camera and microphone found by exact names. Select “Check Studio Return” when ready.{outputMessage}",
    "已按完整名称找到摄像头和麦克风。准备好后请选择“检查 Studio Return”。{outputMessage}"
  ],
  "камеру": [
    "camera",
    "摄像头"
  ],
  "микрофон": [
    "microphone",
    "麦克风"
  ],
  " и ": [
    " and ",
    "和"
  ],
  "Не удалось однозначно сопоставить {value0}. Проверьте и выберите устройства вручную; эфир останется выключенным.": [
    "Could not uniquely match {value0}. Check and select devices manually; the broadcast will remain off.",
    "无法唯一匹配{value0}。请检查并手动选择设备；直播将保持关闭。"
  ],
  "источники": [
    "sources",
    "来源"
  ],
  "Разрешите доступ к камере и микрофону, затем повторите: {message}": [
    "Allow camera and microphone access, then retry: {message}",
    "请允许访问摄像头和麦克风，然后重试：{message}"
  ],
  "Нужен доступ к камере и микрофону для сопоставления устройств.": [
    "Camera and microphone access is required to match devices.",
    "匹配设备需要访问摄像头和麦克风。"
  ],
  "Не удалось задать лимит камеры": [
    "Could not set the camera limit",
    "无法设置摄像头限制"
  ],
  "Лимит камеры не применён": [
    "Camera limit was not applied",
    "未能应用摄像头限制"
  ],
  "Не удалось перевести гостя": [
    "Could not move the guest",
    "无法转移嘉宾"
  ],
  "Свежие измерения": [
    "Fresh measurements",
    "最新测量数据"
  ],
  "Основная студия офлайн. Ожидаем повторное подключение.": [
    "The primary studio is offline. Waiting for reconnection.",
    "主导播台已离线。正在等待重新连接。"
  ],
  "Измерения устарели. Ожидаем новый замер.": [
    "Measurements are stale. Waiting for a new sample.",
    "测量数据已过期。正在等待新数据。"
  ],
  "Ожидание первого замера…": [
    "Waiting for the first sample…",
    "正在等待首次测量…"
  ],
  "Раздел студии": [
    "Studio section",
    "导播台栏目"
  ],
  "Студия": [
    "Studio",
    "导播台"
  ],
  "Участники": [
    "Participants",
    "参与者"
  ],
  "Статистика": [
    "Statistics",
    "统计"
  ],
  "АКТИВНАЯ КОМНАТА": [
    "ACTIVE ROOM",
    "当前房间"
  ],
  "гостей в комнате": [
    "guests in the room",
    "位嘉宾在房间中"
  ],
  "Выйти из комнаты": [
    "Leave room",
    "离开房间"
  ],
  "РАБОЧАЯ СТУДИЯ": [
    "STUDIO WORKSPACE",
    "导播工作台"
  ],
  "Настройки комнаты": [
    "Room settings",
    "房间设置"
  ],
  "Комната": [
    "Room",
    "房间"
  ],
  "Основная студия": [
    "Primary studio",
    "主导播台"
  ],
  "Администратор": [
    "Administrator",
    "管理员"
  ],
  "Подключение": [
    "Connecting",
    "正在连接"
  ],
  "Не удалось принять управление": [
    "Could not take control",
    "无法接管控制权限"
  ],
  "Принять управление": [
    "Take control",
    "接管控制权限"
  ],
  "Студия включила только свой просмотр": [
    "The studio enabled studio-only viewing",
    "导播台已开启仅观看导播台模式"
  ],
  "Проверка Studio Return остановлена": [
    "Studio Return check stopped",
    "Studio Return 检查已停止"
  ],
  "Приглашения и доступы": [
    "Invitations and access",
    "邀请和访问权限"
  ],
  "Зрителей отдельного потока:": [
    "Separate stream viewers:",
    "独立流观看人数："
  ],
  "Не удалось изменить режим видео.": [
    "Could not change video mode.",
    "无法更改视频模式。"
  ],
  "Не удалось изменить режим комнаты": [
    "Could not change room mode",
    "无法更改房间模式"
  ],
  "Ошибка режима комнаты": [
    "Room mode error",
    "房间模式错误"
  ],
  "Диагностика:": [
    "Diagnostics:",
    "诊断："
  ],
  "Параметры комнаты восстановлены. Проверьте источники перед эфиром.": [
    "Room settings restored. Check sources before going live.",
    "房间设置已恢复。请在直播前检查来源。"
  ],
  "Проверяем устройства…": [
    "Checking devices…",
    "正在检查设备…"
  ],
  "Сопоставить прежние устройства": [
    "Match previous devices",
    "匹配之前的设备"
  ],
  "Не удалось переключить вывод: {error}": [
    "Could not switch output: {error}",
    "无法切换输出：{error}"
  ],
  "Предпросмотр видео и аудио, которые отправляются гостям.": [
    "Preview of video and audio sent to guests.",
    "发送给嘉宾的视频和音频预览。"
  ],
  "Мой Studio Return — мониторинг": [
    "My Studio Return — monitoring",
    "我的 Studio Return — 监听"
  ],
  "Эти переключатели меняют только предпросмотр. ON AIR управляет эфиром. Для прослушивания собственного микрофона используйте наушники.": [
    "These switches only affect the preview. ON AIR controls the broadcast. Use headphones to monitor your own microphone.",
    "这些开关仅影响预览。ON AIR 控制直播。监听自己的麦克风时请使用耳机。"
  ],
  "Лимит камеры задаёт общий бюджет кодировщика гостя и выбор слоя для предпросмотра. Это не CBR; фактический битрейт зависит от кадра и сети.": [
    "The camera limit sets the guest encoder budget and preview layer selection. This is not CBR; actual bitrate depends on the picture and network.",
    "摄像头限制设置嘉宾编码器的总码率预算和预览层选择。此设置并非 CBR；实际码率取决于画面和网络。"
  ],
  "Видео гостей": [
    "Guest video",
    "嘉宾视频"
  ],
  "Индивидуальные выходы · видео + аудио": [
    "Individual outputs · video + audio",
    "独立输出 · 视频 + 音频"
  ],
  "Не удалось изменить автоматику.": [
    "Could not change automatic failover.",
    "无法更改自动故障转移设置。"
  ],
  "Не удалось активировать резерв.": [
    "Could not activate the reserve.",
    "无法启用备用服务器。"
  ],
  "Студия запустила перенос. Подключаемся на другом сервере…": [
    "The studio started a transfer. Connecting on another server…",
    "导播台已开始转移。正在连接另一台服务器…"
  ],
  "Сервер не выдал идентификатор участника": [
    "The server did not provide a participant identity",
    "服务器未提供参与者标识"
  ],
  "Настройки гостя сейчас заняты": [
    "Guest settings are currently busy",
    "嘉宾设置目前正在处理中"
  ],
  "Смена режима отменена из-за переподключения": [
    "Mode change cancelled due to reconnection",
    "因重新连接，模式切换已取消"
  ],
  "Не удалось сменить режим микрофона": [
    "Could not change microphone mode",
    "无法更改麦克风模式"
  ],
  "Запасной маршрут TURN не настроен": [
    "The backup TURN route is not configured",
    "尚未配置备用 TURN 路由"
  ],
  "Не удалось подтвердить подключение по новому маршруту": [
    "Could not confirm connection using the new route",
    "无法确认通过新路由的连接"
  ],
  "Не удалось сменить маршрут": [
    "Could not change the route",
    "无法更改路由"
  ],
  "Перенос или выход отменил команду": [
    "Transfer or exit cancelled the command",
    "转移或退出取消了命令"
  ],
  "На главную": [
    "Home",
    "首页"
  ],
  "Войти снова": [
    "Join again",
    "重新加入"
  ],
  "Проверка комнаты…": [
    "Checking room…",
    "正在检查房间…"
  ],
  "Комната не найдена": [
    "Room not found",
    "找不到房间"
  ],
  "Такой комнаты не существует. Проверьте ссылку или обратитесь в студию.": [
    "This room does not exist. Check the link or contact the studio.",
    "此房间不存在。请检查链接或联系导播台。"
  ],
  "Как вас представить в эфире?": [
    "How should we introduce you on air?",
    "直播中如何介绍您？"
  ],
  "Например: Алексей": [
    "For example: Alex",
    "例如：小明"
  ],
  "Продолжить": [
    "Continue",
    "继续"
  ],
  "УЧАСТНИК ЭФИРА": [
    "BROADCAST PARTICIPANT",
    "直播参与者"
  ],
  "КОМНАТА": [
    "ROOM",
    "房间"
  ],
  "В КОМНАТЕ ·": [
    "IN THE ROOM ·",
    "房间内 ·"
  ],
  "Вы": [
    "You",
    "您"
  ],
  "Гость комнаты": [
    "Room guest",
    "房间嘉宾"
  ],
  "КОМНАТА В ЭФИРЕ": [
    "LIVE ROOM",
    "直播房间"
  ],
  "Повторить подключение": [
    "Retry connection",
    "重试连接"
  ],
  "Включить звук от студии": [
    "Enable studio audio",
    "开启导播台音频"
  ],
  "Вы вышли из комнаты.": [
    "You left the room.",
    "您已离开房间。"
  ],
  "ЛИЧНЫЕ ПАРАМЕТРЫ": [
    "PERSONAL SETTINGS",
    "个人设置"
  ],
  "Устройства и мониторинг": [
    "Devices and monitoring",
    "设备和监听"
  ],
  "Собственный мониторинг": [
    "Self monitoring",
    "自身监听"
  ],
  "Звук, видео и громкость меняются только для вас. Другие участники и выходы vMix не затрагиваются.": [
    "Audio, video and volume changes affect only you. Other participants and vMix outputs are unaffected.",
    "音频、视频和音量更改仅对您生效。不影响其他参与者和 vMix 输出。"
  ],
  "Я": [
    "Me",
    "我"
  ],
  "Ожидание других участников.": [
    "Waiting for other participants.",
    "正在等待其他参与者。"
  ],
  "Не удалось выполнить команду студии: {value0}": [
    "Could not execute the studio command: {value0}",
    "无法执行导播台命令：{value0}"
  ],
  "ошибка устройства": [
    "device error",
    "设备错误"
  ],
  "Студия отключила вас от комнаты.": [
    "The studio disconnected you from the room.",
    "导播台已将您移出房间。"
  ],
  "Соединение завершилось после попыток восстановления. Можно подключиться снова без обновления страницы.": [
    "Connection ended after recovery attempts. You can connect again without refreshing the page.",
    "尝试恢复后连接已结束。您可以重新连接，无需刷新页面。"
  ],
  "Не удалось восстановить микрофон": [
    "Could not restore the microphone",
    "无法恢复麦克风"
  ],
  "Подключение через запасной маршрут TURN…": [
    "Connecting through the backup TURN route…",
    "正在通过备用 TURN 路由连接…"
  ],
  "Не удалось включить микрофон": [
    "Could not enable the microphone",
    "无法开启麦克风"
  ],
  "Недоступно браузеру": [
    "Unavailable to the browser",
    "浏览器无法获取"
  ],
  "Неизвестная камера": [
    "Unknown camera",
    "未知摄像头"
  ],
  "{value0} логических потоков (модель скрыта браузером)": [
    "{value0} logical threads (model hidden by the browser)",
    "{value0} 个逻辑线程（浏览器隐藏了型号）"
  ],
  "Не удалось подключиться": [
    "Could not connect",
    "无法连接"
  ],
  "Браузер не смог переключить микрофон": [
    "The browser could not switch the microphone",
    "浏览器无法切换麦克风"
  ],
  "Не найдена системная камера": [
    "System camera not found",
    "找不到系统摄像头"
  ],
  "Браузер не смог переключить камеру": [
    "The browser could not switch the camera",
    "浏览器无法切换摄像头"
  ],
  "Не удалось переключить устройство: {message}": [
    "Could not switch device: {message}",
    "无法切换设备：{message}"
  ],
  "Не удалось переключить устройство": [
    "Could not switch device",
    "无法切换设备"
  ],
  "Выбранный микрофон отключён. Временно используется системный микрофон.": [
    "The selected microphone was disconnected. The system microphone is being used temporarily.",
    "所选麦克风已断开连接。暂时使用系统麦克风。"
  ],
  "Выбранная камера отключена. Временно используется другая доступная камера.": [
    "The selected camera was disconnected. Another available camera is being used temporarily.",
    "所选摄像头已断开连接。暂时使用另一台可用摄像头。"
  ],
  "Не удалось восстановить устройство: {message}": [
    "Could not restore device: {message}",
    "无法恢复设备：{message}"
  ],
  "Не удалось восстановить устройство": [
    "Could not restore device",
    "无法恢复设备"
  ],
  "Комната не найдена. Создайте новую или проверьте название.": [
    "Room not found. Create a new room or check the name.",
    "找不到房间。请创建新房间或检查名称。"
  ],
  "Введите пароль студии, чтобы вернуться в свою комнату.": [
    "Enter the studio password to return to your room.",
    "请输入导播台密码以返回您的房间。"
  ],
  "Не удалось проверить доступ. Попробуйте войти снова.": [
    "Could not verify access. Try signing in again.",
    "无法验证访问权限。请尝试重新登录。"
  ],
  "Не удалось открыть студию.": [
    "Could not open the studio.",
    "无法打开导播台。"
  ],
  "Проверка доступа…": [
    "Checking access…",
    "正在检查访问权限…"
  ],
  "Не удалось выйти из студии. Попробуйте снова.": [
    "Could not sign out of the studio. Try again.",
    "无法退出导播台。请重试。"
  ],
  "Не удалось выйти из студии.": [
    "Could not sign out of the studio.",
    "无法退出导播台。"
  ],
  "СТУДИЯ": [
    "STUDIO",
    "导播台"
  ],
  "Войти в существующую": [
    "Join an existing room",
    "进入现有房间"
  ],
  "Создать комнату": [
    "Create room",
    "创建房间"
  ],
  "Вернитесь в свою студию по названию и паролю студии.": [
    "Return to your studio using the room name and studio password.",
    "使用房间名称和导播台密码返回您的导播台。"
  ],
  "Создайте свою студию и пригласите гостей.": [
    "Create your studio and invite guests.",
    "创建您的导播台并邀请嘉宾。"
  ],
  "Новая комната": [
    "New room",
    "新房间"
  ],
  "Название комнаты": [
    "Room name",
    "房间名称"
  ],
  "Пароль студии": [
    "Studio password",
    "导播台密码"
  ],
  "Минимум 8 символов. Сохраните пароль: он нужен для управления вашей комнатой.": [
    "At least 8 characters. Keep this password: you need it to manage your room.",
    "至少 8 个字符。请保存此密码：管理房间时需要使用。"
  ],
  "Пароль гостей (необязательно)": [
    "Guest password (optional)",
    "嘉宾密码（可选）"
  ],
  "Проверка…": [
    "Checking…",
    "正在检查…"
  ],
  "Открыть мою студию": [
    "Open my studio",
    "打开我的导播台"
  ],
  "Создать и открыть студию": [
    "Create and open studio",
    "创建并打开导播台"
  ],
  "ГОСТЬ": [
    "GUEST",
    "嘉宾"
  ],
  "Войти в комнату": [
    "Join room",
    "加入房间"
  ],
  "Введите название комнаты. Затем проверьте камеру и микрофон перед входом.": [
    "Enter the room name. Then check your camera and microphone before joining.",
    "请输入房间名称，然后在加入前检查摄像头和麦克风。"
  ],
  "Войти как гость": [
    "Join as guest",
    "以嘉宾身份加入"
  ],
  "Для камеры и микрофона нужен HTTPS и разрешение браузера. Можно войти с отключёнными устройствами.": [
    "Camera and microphone require HTTPS and browser permission. You can join with devices disabled.",
    "摄像头和麦克风需要 HTTPS 和浏览器授权。您也可以关闭设备后加入。"
  ],
  "Проверьте устройства вручную: {value0}.": [
    "Check devices manually: {value0}.",
    "请手动检查设备：{value0}。"
  ],
  "Не удалось открыть устройства": [
    "Could not open devices",
    "无法打开设备"
  ],
  "Не удалось проверить выход звука": [
    "Could not test audio output",
    "无法测试音频输出"
  ],
  "CastLink · проверка перед эфиром": [
    "CastLink · pre-broadcast check",
    "CastLink · 直播前检查"
  ],
  "Камера отключена ✓": [
    "Camera disabled ✓",
    "摄像头已关闭 ✓"
  ],
  "Войти без камеры": [
    "Join without camera",
    "不使用摄像头加入"
  ],
  "Микрофон отключён ✓": [
    "Microphone disabled ✓",
    "麦克风已关闭 ✓"
  ],
  "Войти без микрофона": [
    "Join without microphone",
    "不使用麦克风加入"
  ],
  "Можно отключить одно или оба устройства. Отключение микрофона не выключает звук студии и участников.": [
    "You can disable either or both devices. Disabling the microphone does not mute studio or participant audio.",
    "您可以关闭其中一个或两个设备。关闭麦克风不会关闭导播台和参与者的声音。"
  ],
  "Микрофон": [
    "Microphone",
    "麦克风"
  ],
  "Говорите в микрофон: шкала показывает реальный сигнал. Звук микрофона не воспроизводится в динамиках.": [
    "Speak into the microphone: the meter shows the actual signal. Microphone audio is not played through the speakers.",
    "请对着麦克风说话：电平表显示实际信号。麦克风声音不会通过扬声器播放。"
  ],
  "Нажмите «Проверить микрофон», затем говорите.": [
    "Click “Test microphone”, then speak.",
    "点击“测试麦克风”，然后说话。"
  ],
  "Усиление микрофона": [
    "Microphone gain",
    "麦克风增益"
  ],
  "Остановить тест микрофона": [
    "Stop microphone test",
    "停止麦克风测试"
  ],
  "Проверить микрофон": [
    "Test microphone",
    "测试麦克风"
  ],
  "Остановить тест звука": [
    "Stop audio test",
    "停止音频测试"
  ],
  "Проверить наушники / динамики": [
    "Test headphones / speakers",
    "测试耳机 / 扬声器"
  ],
  "Проверить устройства": [
    "Check devices",
    "检查设备"
  ],
  "Войти в конференцию": [
    "Join conference",
    "加入会议"
  ],
  "Режим микрофона": [
    "Microphone mode",
    "麦克风模式"
  ],
  "Обычная речь": [
    "Normal speech",
    "普通语音"
  ],
  "Оригинальный звук": [
    "Original sound",
    "原始声音"
  ],
  "Без шумоподавления и автоматического усиления. Используйте наушники, чтобы избежать эха.": [
    "No noise suppression or automatic gain. Use headphones to avoid echo.",
    "不使用降噪或自动增益。请使用耳机以避免回声。"
  ],
  "Переключение микрофона…": [
    "Switching microphone…",
    "正在切换麦克风…"
  ],
  "Не удалось включить камеру. Проверьте выбранное устройство и разрешение браузера.": [
    "Could not enable the camera. Check the selected device and browser permission.",
    "无法开启摄像头。请检查所选设备和浏览器权限。"
  ],
  "Выключить камеру": [
    "Turn camera off",
    "关闭摄像头"
  ],
  "Включить камеру": [
    "Turn camera on",
    "开启摄像头"
  ],
  "Камера": [
    "Camera",
    "摄像头"
  ],
  "Камера выключена": [
    "Camera off",
    "摄像头已关闭"
  ],
  "Не удалось переключить микрофон": [
    "Could not toggle the microphone",
    "无法切换麦克风状态"
  ],
  "Выключить микрофон": [
    "Turn microphone off",
    "关闭麦克风"
  ],
  "Включить микрофон": [
    "Turn microphone on",
    "开启麦克风"
  ],
  "Микрофон выключен": [
    "Microphone off",
    "麦克风已关闭"
  ],
  "Текущий сервер": [
    "Current server",
    "当前服务器"
  ],
  "Локальный сервер": [
    "Local server",
    "本地服务器"
  ],
  "Сервер для подключения гостя": [
    "Guest connection server",
    "嘉宾连接服务器"
  ],
  "Сервер подключения": [
    "Connection server",
    "连接服务器"
  ],
  "Загрузка…": [
    "Loading…",
    "正在加载…"
  ],
  "Сервер": [
    "Server",
    "服务器"
  ],
  "Сервер гостя": [
    "Guest server",
    "嘉宾服务器"
  ],
  "Название комнаты и пароль вводятся на выбранном сервере. Приглашение с текущего сайта туда не переносится.": [
    "Enter the room name and password on the selected server. Invitations from this site are not transferred there.",
    "请在所选服务器上输入房间名称和密码。当前网站的邀请不会转移到该服务器。"
  ],
  "Не удалось открыть сервер": [
    "Could not open the server",
    "无法打开服务器"
  ],
  "Открыть выбранный сервер": [
    "Open selected server",
    "打开所选服务器"
  ],
  "Добавить другой сервер": [
    "Add another server",
    "添加其他服务器"
  ],
  "Название сервера": [
    "Server name",
    "服务器名称"
  ],
  "Моя студия": [
    "My studio",
    "我的导播台"
  ],
  "HTTPS-адрес": [
    "HTTPS address",
    "HTTPS 地址"
  ],
  "Адрес добавлен на эту страницу, но браузер не разрешил сохранить его.": [
    "The address was added to this page, but the browser did not allow saving it.",
    "地址已添加到此页面，但浏览器不允许保存。"
  ],
  "Проверьте адрес": [
    "Check the address",
    "请检查地址"
  ],
  "Сохранить адрес": [
    "Save address",
    "保存地址"
  ],
  "Камера включена": [
    "Camera on",
    "摄像头已开启"
  ],
  "Видео": [
    "Video",
    "视频"
  ],
  "Микрофон включён": [
    "Microphone on",
    "麦克风已开启"
  ],
  "Аудио": [
    "Audio",
    "音频"
  ],
  "Открыть выход": [
    "Open output",
    "打开输出"
  ],
  "Индивидуальная ссылка на видео и аудио участника": [
    "Individual link to participant video and audio",
    "参与者视频和音频的独立链接"
  ],
  "Скопировано": [
    "Copied",
    "已复制"
  ],
  "Копировать URL": [
    "Copy URL",
    "复制链接"
  ],
  "Лимит кодировщика камеры для всей комнаты; не постоянный CBR и не полный сетевой трафик": [
    "Camera encoder limit for the entire room; not constant CBR or total network traffic",
    "整个房间的摄像头编码器限制；并非固定 CBR 或总网络流量"
  ],
  "Лимит камеры": [
    "Camera limit",
    "摄像头限制"
  ],
  "Битрейт участника {name}": [
    "Participant bitrate: {name}",
    "参与者码率：{name}"
  ],
  "кбит/с": [
    "kbps",
    "千比特/秒"
  ],
  "Экран участника": [
    "Participant screen",
    "参与者屏幕"
  ],
  "Отдельный input для vMix / Browser Source": [
    "Separate input for vMix / Browser Source",
    "用于 vMix / Browser Source 的独立输入"
  ],
  "Открыть экран": [
    "Open screen",
    "打开屏幕"
  ],
  "Копировать URL экрана": [
    "Copy screen URL",
    "复制屏幕链接"
  ],
  "Устройства и качество соединения": [
    "Devices and connection quality",
    "设备和连接质量"
  ],
  "Сведения об участнике {name}": [
    "Participant details: {name}",
    "参与者信息：{name}"
  ],
  "Разрешение": [
    "Resolution",
    "分辨率"
  ],
  "Приём камеры · факт": [
    "Camera received · actual",
    "摄像头接收 · 实际"
  ],
  "{bitrateKbps} кбит/с": [
    "{bitrateKbps} kbps",
    "{bitrateKbps} 千比特/秒"
  ],
  "Сеть": [
    "Network",
    "网络"
  ],
  "ОС": [
    "OS",
    "操作系统"
  ],
  "мс": [
    "ms",
    "毫秒"
  ],
  "Потери / Аудио": [
    "Loss / Audio",
    "丢包 / 音频"
  ],
  "пак. /": [
    "pkts /",
    "包 /"
  ],
  "Гости": [
    "Guests",
    "嘉宾"
  ],
  "Мониторинг гостей меняется только в этой студии. Громкость и выключение видео не влияют на эфир, других гостей и выходы vMix.": [
    "Guest monitoring changes affect only this studio. Volume and video switches do not affect the broadcast, other guests or vMix outputs.",
    "嘉宾监听更改仅对当前导播台生效。音量和视频开关不影响直播、其他嘉宾或 vMix 输出。"
  ],
  "Подключённых гостей пока нет.": [
    "No guests connected yet.",
    "尚无嘉宾连接。"
  ],
  "Гость": [
    "Guest",
    "嘉宾"
  ],
  "Перевести в комнату…": [
    "Move to room…",
    "转移到房间…"
  ],
  "Перевести": [
    "Move",
    "转移"
  ],
  "Отключить гостя": [
    "Disconnect guest",
    "断开嘉宾连接"
  ],
  "↻ Обновить": [
    "↻ Refresh",
    "↻ 刷新"
  ],
  "Открыть": [
    "Open",
    "打开"
  ],
  "Нет доступа к устройствам": [
    "Device access denied",
    "无法访问设备"
  ],
  "Не удалось переключить вывод звука": [
    "Could not switch audio output",
    "无法切换音频输出"
  ],
  "Камера · захват изображения": [
    "Camera · image capture",
    "摄像头 · 图像采集"
  ],
  "Системная камера": [
    "System camera",
    "系统摄像头"
  ],
  "Микрофон · захват звука": [
    "Microphone · audio capture",
    "麦克风 · 音频采集"
  ],
  "Системный микрофон": [
    "System microphone",
    "系统麦克风"
  ],
  "Наушники / динамики · вывод звука": [
    "Headphones / speakers · audio output",
    "耳机 / 扬声器 · 音频输出"
  ],
  "Наушники / динамики": [
    "Headphones / speakers",
    "耳机 / 扬声器"
  ],
  "Разрешите доступ к камере и микрофону, чтобы увидеть названия устройств.": [
    "Allow camera and microphone access to see device names.",
    "请允许访问摄像头和麦克风以查看设备名称。"
  ],
  "Не удалось переключить вывод:": [
    "Could not switch output:",
    "无法切换输出："
  ],
  "Выбор наушников не поддерживается этим браузером.": [
    "Headphone selection is not supported by this browser.",
    "此浏览器不支持选择耳机。"
  ],
  "Обновить список устройств": [
    "Refresh device list",
    "刷新设备列表"
  ],
  "На весь экран / свернуть": [
    "Full screen / exit full screen",
    "全屏 / 退出全屏"
  ],
  "На весь экран: {value0}": [
    "Full screen: {value0}",
    "全屏：{value0}"
  ],
  "Ожидание эфира студии…": [
    "Waiting for the studio broadcast…",
    "正在等待导播台直播…"
  ],
  "Открыть чат": [
    "Open chat",
    "打开聊天"
  ],
  "Чат": [
    "Chat",
    "聊天"
  ],
  "Кнопка показа экрана позволяет выбрать экран или окно приложения. Чтобы передать звук, включите его в диалоге браузера, если такая настройка доступна.": [
    "The screen sharing button lets you select a screen or application window. To share audio, enable it in the browser dialog if that option is available.",
    "屏幕共享按钮允许您选择屏幕或应用窗口。如需共享音频，请在浏览器对话框中启用该选项（若可用）。"
  ],
  "Не удалось отправить сообщение. Попробуйте ещё раз.": [
    "Could not send the message. Try again.",
    "无法发送消息。请重试。"
  ],
  "Чат комнаты": [
    "Room chat",
    "房间聊天"
  ],
  "Закрыть чат": [
    "Close chat",
    "关闭聊天"
  ],
  "Закрыть": [
    "Close",
    "关闭"
  ],
  "Сообщение": [
    "Message",
    "消息"
  ],
  "Сообщение…": [
    "Message…",
    "消息…"
  ],
  "Отправить": [
    "Send",
    "发送"
  ],
  "Демонстрация экрана недоступна в этом браузере. На Android Chrome веб-версия не поддерживает захват экрана.": [
    "Screen sharing is unavailable in this browser. The web version does not support screen capture in Android Chrome.",
    "此浏览器无法使用屏幕共享。网页版不支持在 Android Chrome 中采集屏幕。"
  ],
  "Выбор экрана отменён или браузер не разрешил захват.": [
    "Screen selection was cancelled or the browser denied capture permission.",
    "屏幕选择已取消，或浏览器未允许采集。"
  ],
  "Не удалось включить показ экрана": [
    "Could not start screen sharing",
    "无法开始屏幕共享"
  ],
  "Демонстрация экрана не поддерживается этим браузером": [
    "Screen sharing is not supported by this browser",
    "此浏览器不支持屏幕共享"
  ],
  "Остановить показ экрана": [
    "Stop screen sharing",
    "停止屏幕共享"
  ],
  "Показать экран / приложение": [
    "Share screen / application",
    "共享屏幕 / 应用"
  ],
  "Подключаем…": [
    "Connecting…",
    "正在连接…"
  ],
  "Экран: выкл.": [
    "Screen: off",
    "屏幕：关闭"
  ],
  "Экран": [
    "Screen",
    "屏幕"
  ],
  "Этот браузер не умеет захватывать экран через веб-страницу. На Android Chrome используйте другой способ передачи экрана; на компьютере откройте CastLink в Chrome/Edge.": [
    "This browser cannot capture the screen from a web page. On Android Chrome, use another screen sharing method; on a computer, open CastLink in Chrome/Edge.",
    "此浏览器无法通过网页采集屏幕。在 Android Chrome 中请使用其他屏幕共享方式；在电脑上请使用 Chrome/Edge 打开 CastLink。"
  ],
  "В диалоге браузера выберите экран, окно приложения или вкладку. Для звука включите «Поделиться звуком», если такая настройка доступна.": [
    "In the browser dialog, select a screen, application window or tab. Enable “Share audio” if that option is available.",
    "请在浏览器对话框中选择屏幕、应用窗口或标签页。如有“共享音频”选项，请将其开启。"
  ],
  "Показ экрана недоступен в этом браузере": [
    "Screen sharing is unavailable in this browser",
    "此浏览器无法使用屏幕共享"
  ],
  "Не удалось получить список устройств вывода": [
    "Could not retrieve audio output devices",
    "无法获取音频输出设备列表"
  ],
  "Не удалось выбрать выход звука. Проверьте подключение устройства и разрешения браузера.": [
    "Could not select audio output. Check the device connection and browser permissions.",
    "无法选择音频输出。请检查设备连接和浏览器权限。"
  ],
  "Вывод звука": [
    "Audio output",
    "音频输出"
  ],
  "Системное устройство": [
    "System device",
    "系统设备"
  ],
  "Динамики / наушники": [
    "Speakers / headphones",
    "扬声器 / 耳机"
  ],
  "В этом браузере выход выбирается в настройках системы.": [
    "In this browser, select the output in system settings.",
    "在此浏览器中，请通过系统设置选择输出。"
  ],
  "Измерение уровня недоступно в этом браузере.": [
    "Level measurement is unavailable in this browser.",
    "此浏览器无法测量电平。"
  ],
  "Нет сигнала": [
    "No signal",
    "无信号"
  ],
  "Управление Studio Return": [
    "Studio Return controls",
    "Studio Return 控制"
  ],
  "Гости могут видеть только студию": [
    "Guests can only see the studio",
    "嘉宾只能看到导播台"
  ],
  "Остановить проверку": [
    "Stop check",
    "停止检查"
  ],
  "Проверить Studio Return": [
    "Check Studio Return",
    "检查 Studio Return"
  ],
  "Завершить эфир": [
    "End broadcast",
    "结束直播"
  ],
  "Начать эфир": [
    "Start broadcast",
    "开始直播"
  ],
  "По ссылке /watch": [
    "Via /watch link",
    "通过 /watch 链接"
  ],
  "В комнату": [
    "To the room",
    "发送到房间"
  ],
  "{videoKbps} кбит/с": [
    "{videoKbps} kbps",
    "{videoKbps} 千比特/秒"
  ],
  "Исходящий поток студии": [
    "Studio outgoing stream",
    "导播台出站流"
  ],
  "Измерения": [
    "Measurements",
    "测量数据"
  ],
  "Источник измерений потока": [
    "Stream measurement source",
    "流测量来源"
  ],
  "Авто": [
    "Auto",
    "自动"
  ],
  "Измерено · В комнату:": [
    "Measured · To the room:",
    "实测 · 发送到房间："
  ],
  "· По ссылке /watch:": [
    "· Via /watch link:",
    "· 通过 /watch 链接："
  ],
  "График:": [
    "Chart:",
    "图表："
  ],
  " · Авто": [
    " · Auto",
    " · 自动"
  ],
  "Измеренный видеобитрейт основной комнаты: 0 кбит/с.": [
    "Measured primary room video bitrate: 0 kbps.",
    "主房间视频实测码率：0 千比特/秒。"
  ],
  "Частота кадров": [
    "Frame rate",
    "帧率"
  ],
  "Измеренный видеобитрейт": [
    "Measured video bitrate",
    "实测视频码率"
  ],
  "Аудиобитрейт": [
    "Audio bitrate",
    "音频码率"
  ],
  "{audioKbps} кбит/с": [
    "{audioKbps} kbps",
    "{audioKbps} 千比特/秒"
  ],
  "Видеобитрейт за последние 2 минуты, шкала до 25 000 кбит/с": [
    "Video bitrate over the last 2 minutes, scale up to 25,000 kbps",
    "最近 2 分钟的视频码率，刻度上限 25,000 千比特/秒"
  ],
  ", сумма видеослоёв · каждый поток отдельно · каждые 2 сек · последние 2 мин": [
    ", sum of video layers · each stream separately · every 2 sec · last 2 min",
    "，视频层总和 · 每个流分别计算 · 每 2 秒 · 最近 2 分钟"
  ],
  "Текущий видеобитрейт {videoKbps} килобит в секунду": [
    "Current video bitrate: {videoKbps} kilobits per second",
    "当前视频码率：每秒 {videoKbps} 千比特"
  ],
  "Частота кадров студии": [
    "Studio frame rate",
    "导播台帧率"
  ],
  "Общий лимит видеобитрейта (эфир и ссылка)": [
    "Total video bitrate limit (broadcast and link)",
    "视频总码率限制（直播和链接）"
  ],
  "Лимит каждого потока отдельно: Studio Return и /watch. При зрителях суммарный видеотрафик может достигать удвоенного лимита.": [
    "The limit applies separately to Studio Return and /watch. With viewers, total video traffic may reach twice the limit.",
    "此限制分别应用于 Studio Return 和 /watch。有观众时，总视频流量可能达到限制的两倍。"
  ],
  "Связь с панелью:": [
    "Panel connection:",
    "面板连接："
  ],
  "Продление управления:": [
    "Control renewal:",
    "控制权限续期："
  ],
  "Видеокодек": [
    "Video codec",
    "视频编解码器"
  ],
  "Видеокодек студии": [
    "Studio video codec",
    "导播台视频编解码器"
  ],
  "VP8 (по умолчанию)": [
    "VP8 (default)",
    "VP8（默认）"
  ],
  "Поток основной студии": [
    "Primary studio stream",
    "主导播台流"
  ],
  "Режим видеопотока студии": [
    "Studio video stream mode",
    "导播台视频流模式"
  ],
  "Несколько слоёв (AV1 SVC)": [
    "Multiple layers (AV1 SVC)",
    "多层（AV1 SVC）"
  ],
  "Simulcast (по умолчанию)": [
    "Simulcast (default)",
    "Simulcast（默认）"
  ],
  "Один видеопоток": [
    "Single video stream",
    "单一视频流"
  ],
  "Кодек и режим меняются в OFF AIR. Один слой уменьшает нагрузку; /watch передаётся без дополнительных пространственных слоёв. H264 и AV1 не гарантируют аппаратное ускорение. Для AV1 нужна поддержка у отправителя и зрителей.": [
    "Change the codec and mode while OFF AIR. A single layer reduces load; /watch uses no extra spatial layers. H264 and AV1 do not guarantee hardware acceleration. AV1 requires support from the sender and viewers.",
    "请在 OFF AIR 状态下更改编解码器和模式。单层可减少负载；/watch 不使用额外空间层。H264 和 AV1 不保证硬件加速。AV1 需要发送端和观众端支持。"
  ],
  "Не удалось получить настройки гостя": [
    "Could not retrieve guest settings",
    "无法获取嘉宾设置"
  ],
  "Гость не подтвердил команду. Можно повторить.": [
    "The guest did not confirm the command. You can retry.",
    "嘉宾未确认命令。您可以重试。"
  ],
  "Не удалось получить настройки": [
    "Could not retrieve settings",
    "无法获取设置"
  ],
  "Не удалось отправить команду": [
    "Could not send the command",
    "无法发送命令"
  ],
  "Звук гостя": [
    "Guest audio",
    "嘉宾音频"
  ],
  "Режим микрофона {name}": [
    "Microphone mode: {name}",
    "麦克风模式：{name}"
  ],
  "Шумоподавление": [
    "Noise suppression",
    "降噪"
  ],
  "Маршрут гостя": [
    "Guest route",
    "嘉宾路由"
  ],
  "Маршрут подключения {name}": [
    "Connection route: {name}",
    "连接路由：{name}"
  ],
  "Автоматически": [
    "Automatic",
    "自动"
  ],
  "Обычный": [
    "Normal",
    "普通"
  ],
  "Запасной TURN": [
    "Backup TURN",
    "备用 TURN"
  ],
  "Ожидаем подтверждение гостя…": [
    "Waiting for guest confirmation…",
    "正在等待嘉宾确认…"
  ],
  "Переподключение…": [
    "Reconnecting…",
    "正在重新连接…"
  ],
  "Гость отключён. Показаны последние подтверждённые настройки.": [
    "Guest disconnected. Showing the last confirmed settings.",
    "嘉宾已断开连接。显示最后确认的设置。"
  ],
  "Настройки подтверждены гостем.": [
    "Settings confirmed by the guest.",
    "嘉宾已确认设置。"
  ],
  "Ожидаем состояние гостя…": [
    "Waiting for guest state…",
    "正在等待嘉宾状态…"
  ],
  "Шумоподавление включено на микрофоне гостя.": [
    "Noise suppression is enabled on the guest microphone.",
    "嘉宾麦克风已开启降噪。"
  ],
  "Шумоподавление выключено.": [
    "Noise suppression is off.",
    "降噪已关闭。"
  ],
  "Обработка применится при включении микрофона.": [
    "Processing will be applied when the microphone is enabled.",
    "处理将在麦克风开启时应用。"
  ],
  "Браузер гостя не подтвердил состояние шумоподавления.": [
    "The guest browser did not confirm the noise suppression state.",
    "嘉宾浏览器未确认降噪状态。"
  ],
  "Для оригинального звука гостю нужны наушники.": [
    "The guest needs headphones for original sound.",
    "使用原始声音时，嘉宾需要佩戴耳机。"
  ],
  "TURN через TLS:443.": [
    "TURN over TLS:443.",
    "TURN 通过 TLS:443。"
  ],
  "TURN через UDP; сеть должна пропускать UDP.": [
    "TURN over UDP; the network must allow UDP.",
    "TURN 通过 UDP；网络必须允许 UDP。"
  ],
  "Смена маршрута переподключает гостя.": [
    "Changing the route reconnects the guest.",
    "更改路由会使嘉宾重新连接。"
  ],
  "Подключение {name}": [
    "Connecting {name}",
    "正在连接 {name}"
  ],
  "Закрыть сообщение": [
    "Dismiss message",
    "关闭消息"
  ],
  "Камера основной студии": [
    "Primary studio camera",
    "主导播台摄像头"
  ],
  "Микрофон основной студии": [
    "Primary studio microphone",
    "主导播台麦克风"
  ],
  "Динамики / наушники основной студии": [
    "Primary studio speakers / headphones",
    "主导播台扬声器 / 耳机"
  ],
  "Устройства основной студии": [
    "Primary studio devices",
    "主导播台设备"
  ],
  "Устройство недоступно": [
    "Device unavailable",
    "设备不可用"
  ],
  "Выберите устройство": [
    "Select device",
    "选择设备"
  ],
  "Это устройства компьютера основной студии. Для смены камеры и микрофона выключите эфир.": [
    "These are devices on the primary studio computer. Turn off the broadcast before changing the camera or microphone.",
    "这些是主导播台电脑上的设备。请关闭直播后再更换摄像头或麦克风。"
  ],
  "Основная студия не подключена.": [
    "The primary studio is not connected.",
    "主导播台尚未连接。"
  ],
  "Ожидаем список устройств. Разрешите доступ к ним в основной студии.": [
    "Waiting for the device list. Allow device access in the primary studio.",
    "正在等待设备列表。请在主导播台允许设备访问。"
  ],
  "Основная студия применяет выбор…": [
    "The primary studio is applying the selection…",
    "主导播台正在应用所选设备…"
  ],
  "Захват выбранной камеры и микрофона начнётся при включении проверки Studio Return.": [
    "The selected camera and microphone will start capturing when the Studio Return check is enabled.",
    "启用 Studio Return 检查时，将开始采集所选摄像头和麦克风。"
  ],
  "{title} не включено": [
    "{title} is not enabled",
    "{title}尚未开启"
  ],
  "Видео скрыто у вас": [
    "Video is hidden for you",
    "视频已对您隐藏"
  ],
  "Экран / приложение": [
    "Screen / application",
    "屏幕 / 应用"
  ],
  "Звук {name} только у меня": [
    "Audio from {name} only for me",
    "仅为我播放 {name} 的音频"
  ],
  "Звук вкл.": [
    "Audio on",
    "音频开启"
  ],
  "Звук выкл.": [
    "Audio off",
    "音频关闭"
  ],
  "Видео {name} только у меня": [
    "Video from {name} only for me",
    "仅为我显示 {name} 的视频"
  ],
  "Видео вкл.": [
    "Video on",
    "视频开启"
  ],
  "Видео выкл.": [
    "Video off",
    "视频关闭"
  ],
  "Громкость": [
    "Volume",
    "音量"
  ],
  "Громкость {name} только у меня": [
    "Volume for {name} only for me",
    "仅调整我听到的 {name} 的音量"
  ],
  "Нет соединения с комнатой. Повторите подключение.": [
    "Not connected to the room. Connect again.",
    "尚未连接房间。请重新连接。"
  ],
  "Камера не опубликовалась. Проверьте разрешение браузера и выбранное устройство, затем повторите.": [
    "The camera did not publish. Check browser permission and the selected device, then retry.",
    "摄像头未能发布。请检查浏览器权限和所选设备，然后重试。"
  ],
  "Не удалось выключить камеру. Повторите действие.": [
    "Could not turn the camera off. Try again.",
    "无法关闭摄像头。请重试。"
  ],
  "Голосовая связь отменена": [
    "Talkback cancelled",
    "语音通话已取消"
  ],
  "Выбранный участник уже отключился": [
    "The selected participant has disconnected",
    "所选参与者已断开连接"
  ],
  "Не удалось получить доступ для голосовой связи": [
    "Could not get talkback access",
    "无法获取语音通话权限"
  ],
  "Выбранный участник изменился": [
    "The selected participant has changed",
    "所选参与者已更改"
  ],
  "Приватная голосовая связь": [
    "Private talkback",
    "私人语音通话"
  ],
  "Не удалось начать голосовую связь": [
    "Could not start talkback",
    "无法开始语音通话"
  ],
  "Не удалось изменить камеру": [
    "Could not change the camera",
    "无法更改摄像头"
  ],
  "Голосовая связь": [
    "Talkback",
    "语音通话"
  ],
  "Микрофон передаёт звук только выбранным участникам. Камера публикуется отдельно в комнате.": [
    "The microphone sends audio only to selected participants. The camera is published separately in the room.",
    "麦克风仅向所选参与者发送音频。摄像头在房间中单独发布。"
  ],
  "Кому говорить": [
    "Talk to",
    "通话对象"
  ],
  "Всем в комнате": [
    "Everyone in the room",
    "房间内所有人"
  ],
  "гость": [
    "guest",
    "嘉宾"
  ],
  "администратор": [
    "administrator",
    "管理员"
  ],
  "модератор": [
    "moderator",
    "主持人"
  ],
  "Микрофон голосовой связи": [
    "Talkback microphone",
    "语音通话麦克风"
  ],
  "Завершить разговор": [
    "End conversation",
    "结束通话"
  ],
  "Говорить всем": [
    "Talk to everyone",
    "向所有人讲话"
  ],
  "Говорить приватно": [
    "Talk privately",
    "私人通话"
  ],
  "Камера панели": [
    "Panel camera",
    "面板摄像头"
  ],
  "Переключаем камеру…": [
    "Switching camera…",
    "正在切换摄像头…"
  ],
  "Выключить камеру в комнате": [
    "Turn camera off in the room",
    "关闭房间中的摄像头"
  ],
  "Включить камеру в комнате": [
    "Turn camera on in the room",
    "开启房间中的摄像头"
  ],
  "Моя камера в комнате": [
    "My camera in the room",
    "我在房间中的摄像头"
  ],
  "Камера включена и опубликована в комнате. Здесь показан ваш предпросмотр.": [
    "Camera enabled and published in the room. Your preview is shown here.",
    "摄像头已开启并发布到房间。此处显示您的预览。"
  ],
  "Вы говорите участникам комнаты.": [
    "You are talking to room participants.",
    "您正在向房间参与者讲话。"
  ],
  "Приватный разговор: {value0}.": [
    "Private conversation: {value0}.",
    "私人通话：{value0}。"
  ],
  "Устройства управляются основной студией. Звук опубликованного эфира слышен только у вас.": [
    "Devices are controlled by the primary studio. Only you hear the published broadcast audio.",
    "设备由主导播台控制。已发布的直播音频仅由您收听。"
  ],
  "Не слушать студию": [
    "Stop listening to studio",
    "停止收听导播台"
  ],
  "Слушать студию": [
    "Listen to studio",
    "收听导播台"
  ],
  "Видео основной студии только у меня": [
    "Primary studio video only for me",
    "仅为我显示主导播台视频"
  ],
  "Личная громкость": [
    "Personal volume",
    "个人音量"
  ],
  "Личная громкость Studio Return": [
    "Personal Studio Return volume",
    "个人 Studio Return 音量"
  ],
  "15 минут": [
    "15 minutes",
    "15 分钟"
  ],
  "1 час": [
    "1 hour",
    "1 小时"
  ],
  "6 часов": [
    "6 hours",
    "6 小时"
  ],
  "12 часов": [
    "12 hours",
    "12 小时"
  ],
  "24 часа": [
    "24 hours",
    "24 小时"
  ],
  "Модератор": [
    "Moderator",
    "主持人"
  ],
  "Выход vMix": [
    "vMix output",
    "vMix 输出"
  ],
  "Монитор": [
    "Monitor",
    "监听"
  ],
  "Не удалось выгрузить аудиоисторию. Повторите после обновления статистики.": [
    "Could not export audio history. Retry after refreshing statistics.",
    "无法导出音频历史记录。请刷新统计后重试。"
  ],
  "Сервер не продолжил аудиоисторию": [
    "The server did not continue the audio history",
    "服务器未继续提供音频历史记录"
  ],
  "Подготовлено замеров аудио: {value0}…": [
    "Audio samples prepared: {value0}…",
    "已准备音频测量数据：{value0} 条…"
  ],
  "Аудиоистория выгружена: {value0} замеров за выбранный период и фильтры.": [
    "Audio history exported: {value0} samples for the selected period and filters.",
    "音频历史记录已导出：所选时段和筛选条件下共 {value0} 条测量数据。"
  ],
  "Выгружена часть истории: {value0} замеров. Достигнут лимит файла; выберите отдельную сессию или более короткий период для полной выгрузки.": [
    "Partial history exported: {value0} samples. File limit reached; select one session or a shorter period for a complete export.",
    "已导出部分历史记录：{value0} 条测量数据。已达到文件限制；请选择单个会话或更短的时段以完整导出。"
  ],
  "Не удалось выгрузить замеры. Повторите после обновления статистики.": [
    "Could not export measurements. Retry after refreshing statistics.",
    "无法导出测量数据。请刷新统计后重试。"
  ],
  "Все соединения комнаты": [
    "All room connections",
    "房间所有连接"
  ],
  "Ошибка выгрузки": [
    "Export error",
    "导出错误"
  ],
  "Статистика временно недоступна. Повторяем запрос…": [
    "Statistics are temporarily unavailable. Retrying…",
    "统计暂时不可用。正在重试…"
  ],
  "Ошибка загрузки": [
    "Loading error",
    "加载错误"
  ],
  "Статистика соединений": [
    "Connection statistics",
    "连接统计"
  ],
  "Комната «": [
    "Room “",
    "房间“"
  ],
  "». Замеры клиентов и детальная выгрузка — каждые 2 секунды; обзорные графики обновляются каждые 15 секунд.": [
    "”. Client measurements and detailed exports every 2 seconds; overview charts refresh every 15 seconds.",
    "”。客户端测量和详细导出数据每 2 秒采集一次；概览图表每 15 秒刷新一次。"
  ],
  "Период статистики": [
    "Statistics period",
    "统计时段"
  ],
  "Прошедший день (МСК, UTC+3)": [
    "Past day (Moscow, UTC+3)",
    "过去日期（莫斯科时间，UTC+3）"
  ],
  "Текущая история": [
    "Current history",
    "当前历史记录"
  ],
  "Роль": [
    "Role",
    "角色"
  ],
  "Все роли": [
    "All roles",
    "所有角色"
  ],
  "Участник": [
    "Participant",
    "参与者"
  ],
  "Все участники": [
    "All participants",
    "所有参与者"
  ],
  "Сессия": [
    "Session",
    "会话"
  ],
  "Все сессии выборки": [
    "All sampled sessions",
    "所有采样会话"
  ],
  "Не удалось очистить список": [
    "Could not clear the list",
    "无法清空列表"
  ],
  "Ошибка очистки": [
    "Clear failed",
    "清空失败"
  ],
  "Очистка…": [
    "Clearing…",
    "正在清空…"
  ],
  "Сбросить отключившихся": [
    "Reset disconnected entries",
    "重置已断开连接的记录"
  ],
  "Скачать наглядный отчёт": [
    "Download visual report",
    "下载可视化报告"
  ],
  "Графики → CSV": [
    "Charts → CSV",
    "图表 → CSV"
  ],
  "Участники и потоки → CSV": [
    "Participants and streams → CSV",
    "参与者和流 → CSV"
  ],
  "История аудио → CSV": [
    "Audio history → CSV",
    "音频历史记录 → CSV"
  ],
  "Сброс очищает список завершённых подключений. Активные участники и история графиков сохраняются. CSV открывается в Excel. Наглядный HTML-отчёт с графиками открывается в браузере без интернета. Старые замеры не дополняются вымышленными значениями.": [
    "Reset clears completed connections. Active participants and chart history are retained. CSV opens in Excel. The visual HTML report with charts opens in a browser offline. Missing values are not invented for old measurements.",
    "重置会清除已结束的连接列表。活跃参与者和图表历史记录将保留。CSV 可在 Excel 中打开。含图表的 HTML 可视化报告可在浏览器中离线打开。旧测量数据不会被填入虚构值。"
  ],
  "Входящие — от сервера к клиентам. Исходящие — от клиентов к серверу. Для всех соединений битрейты суммируются, RTT, jitter и потери усредняются. Пропуски — нет замеров.": [
    "Incoming: server to clients. Outgoing: clients to server. Across all connections, bitrates are summed; RTT, jitter and loss are averaged. Gaps mean no measurements.",
    "入站：从服务器到客户端。出站：从客户端到服务器。所有连接的码率相加，RTT、抖动和丢包取平均值。缺口表示没有测量数据。"
  ],
  "История аудио содержит каждый сохранённый замер с точным временем UTC, потерями, concealment, jitter buffer и состоянием воспроизведения выхода. По умолчанию история хранится 30 дней: прошедшие часы сжимаются без потери двухсекундных замеров, без записи аудио и видео. Общий лимит диска может сократить доступный период; уже удалённые старые дни восстановить невозможно. Старые клиенты не передают новые поля. Отсутствие прироста samples и нулевой уровень не доказывают обрыв: возможны тишина и DTX.": [
    "Audio history contains every stored sample with exact UTC time, loss, concealment, jitter buffer and output playback state. The default retention is 30 days: past hours are compressed without losing two-second samples, and no audio or video is recorded. The total disk limit may shorten the available period; deleted days cannot be restored. Older clients do not send new fields. No sample growth and zero level do not prove disconnection: silence and DTX are possible.",
    "音频历史记录包含每条已保存的测量数据及其精确 UTC 时间、丢包、丢包补偿、抖动缓冲区和输出播放状态。默认保留 30 天：过去小时的数据会压缩，但保留每两秒的测量数据，不录制音频或视频。总磁盘限制可能缩短可用时段；已删除的旧日期无法恢复。旧客户端不会发送新字段。samples 没有增长且电平为零并不能证明断线：也可能是静音或 DTX。"
  ],
  "Загружаем историю…": [
    "Loading history…",
    "正在加载历史记录…"
  ],
  "Свежие замеры в конце выборки": [
    "Fresh samples at the end of the selection",
    "所选时段末尾的最新测量数据"
  ],
  "Сейчас передают замеры": [
    "Sending measurements now",
    "当前正在发送测量数据"
  ],
  "Соединений в выборке": [
    "Connections in the selection",
    "所选范围内的连接"
  ],
  "История в выбранном периоде": [
    "History in the selected period",
    "所选时段的历史记录"
  ],
  "Ещё нет данных": [
    "No data yet",
    "暂无数据"
  ],
  "Лимит хранения:": [
    "Retention limit:",
    "保留限制："
  ],
  "дней /": [
    "days /",
    "天 /"
  ],
  "МиБ на сервере. Самый ранний сохранённый час комнаты:": [
    "MiB on the server. Earliest retained room hour:",
    "MiB（服务器）。房间最早保留的小时："
  ],
  " МСК": [
    " Moscow time",
    " 莫斯科时间"
  ],
  "Выбран день {historyDay} по МСК; время графиков — по часовому поясу браузера, CSV — UTC.": [
    "Selected day {historyDay} in Moscow time; chart times use the browser time zone, CSV uses UTC.",
    "所选日期 {historyDay} 按莫斯科时间计算；图表使用浏览器时区，CSV 使用 UTC。"
  ],
  "Графики — по часовому поясу браузера, CSV — UTC.": [
    "Chart times use the browser time zone; CSV uses UTC.",
    "图表使用浏览器时区；CSV 使用 UTC。"
  ],
  "Аудио за выбранный период": [
    "Audio for the selected period",
    "所选时段的音频"
  ],
  "Замеров аудио:": [
    "Audio samples:",
    "音频测量数据："
  ],
  ". С потерями:": [
    ". With loss:",
    "。含丢包："
  ],
  "; с concealment:": [
    "; with concealment:",
    "；含丢包补偿："
  ],
  "; без прироста принятых samples:": [
    "; without received sample growth:",
    "；接收 samples 未增长："
  ],
  ". Замеров с паузой, ошибкой или отсутствием подписки:": [
    ". Samples with pause, error or no subscription:",
    "。暂停、错误或无订阅的测量数据："
  ],
  ". Попыток восстановления по счётчикам сессий:": [
    ". Recovery attempts from session counters:",
    "。会话计数器记录的恢复尝试："
  ],
  "Это числа замеров, а не отдельных происшествий. Счётчики восстановления накоплены с начала сессии и могут включать попытки до выбранного периода. Для разбора выберите роль «Выход vMix», участника и сессию, затем скачайте историю аудио.": [
    "These are sample counts, not individual incidents. Recovery counters accumulate from the start of the session and may include attempts before the selected period. To investigate, select “vMix output”, a participant and a session, then download audio history.",
    "这些数字是测量数据条数，并非独立事件数。恢复计数器从会话开始时累积，可能包括所选时段之前的尝试。如需分析，请选择“vMix 输出”、参与者和会话，然后下载音频历史记录。"
  ],
  "Замеров пока нет. Подключите гостя или выход vMix. История сохраняется на сервере и начинает накапливаться после обновления клиентов.": [
    "No measurements yet. Connect a guest or vMix output. History is stored on the server and starts accumulating after clients update.",
    "暂无测量数据。请连接嘉宾或 vMix 输出。历史记录保存在服务器上，并在客户端更新后开始累积。"
  ],
  "Битрейт": [
    "Bitrate",
    "码率"
  ],
  "Входящие": [
    "Incoming",
    "入站"
  ],
  "Исходящие": [
    "Outgoing",
    "出站"
  ],
  "Задержка и jitter": [
    "Latency and jitter",
    "延迟和抖动"
  ],
  "Аудио и видео": [
    "Audio and video",
    "音频和视频"
  ],
  "Аудио вход": [
    "Audio in",
    "音频入站"
  ],
  "Видео вход": [
    "Video in",
    "视频入站"
  ],
  "Аудио выход": [
    "Audio out",
    "音频出站"
  ],
  "Видео выход": [
    "Video out",
    "视频出站"
  ],
  "Потери пакетов за интервал": [
    "Packet loss per interval",
    "每个间隔的丢包"
  ],
  "Потери": [
    "Loss",
    "丢包"
  ],
  "Соединения с замерами": [
    "Connections with measurements",
    "有测量数据的连接"
  ],
  "шт.": [
    "count",
    "个"
  ],
  "Соединения": [
    "Connections",
    "连接"
  ],
  "Подключения в выбранной выборке": [
    "Connections in the selected sample",
    "所选样本中的连接"
  ],
  "Тип": [
    "Type",
    "类型"
  ],
  "Состояние": [
    "State",
    "状态"
  ],
  "Вход / выход, кбит/с": [
    "In / out, kbps",
    "入站 / 出站，千比特/秒"
  ],
  "RTT / jitter, мс": [
    "RTT / jitter, ms",
    "RTT / 抖动，毫秒"
  ],
  "Потери, %": [
    "Loss, %",
    "丢包，%"
  ],
  "Переподключения": [
    "Reconnections",
    "重新连接次数"
  ],
  "Последний замер": [
    "Latest sample",
    "最新测量"
  ],
  "Отключён": [
    "Disconnected",
    "已断开连接"
  ],
  "Нет свежих замеров": [
    "No recent measurements",
    "没有最新测量数据"
  ],
  "Подключён": [
    "Connected",
    "已连接"
  ],
  "Переподключение": [
    "Reconnecting",
    "正在重新连接"
  ],
  "Качество:": [
    "Quality:",
    "质量："
  ],
  "Потоки:": [
    "Streams:",
    "流："
  ],
  "Время с начала соединения:": [
    "Time since connection:",
    "连接持续时间："
  ],
  "мин. Последний замер:": [
    "min. Latest sample:",
    "分钟。最新测量："
  ],
  "В последнем замере нет активных медиапотоков.": [
    "No active media streams in the latest sample.",
    "最新测量中没有活跃媒体流。"
  ],
  "Направление / источник": [
    "Direction / source",
    "方向 / 来源"
  ],
  "Кодек": [
    "Codec",
    "编解码器"
  ],
  "Размер / FPS": [
    "Size / FPS",
    "尺寸 / FPS"
  ],
  "Потери / jitter / RTT": [
    "Loss / jitter / RTT",
    "丢包 / 抖动 / RTT"
  ],
  "Транспорт": [
    "Transport",
    "传输"
  ],
  "Замирания / ограничение": [
    "Freezes / limitation",
    "卡顿 / 限制"
  ],
  "Вход": [
    "In",
    "入站"
  ],
  "Выход": [
    "Out",
    "出站"
  ],
  "мс /": [
    "ms /",
    "毫秒 /"
  ]
};

// Only known UI templates are recognized; participant names, device labels and external errors stay intact.
const workspaceMessageTemplates = [
  "ON AIR={current}; публикация выключена",
  "Не удалось снять замер: {value0}",
  "Камера и микрофон найдены по точным названиям. Проверяем предпросмотр перед восстановлением эфира.{outputMessage}",
  "Камера и микрофон найдены по точным названиям. Предпросмотр восстановлен; публикация выключена.{outputMessage}",
  "Камера и микрофон найдены по точным названиям. Выберите «Проверить Studio Return», когда будете готовы.{outputMessage}",
  "Не удалось однозначно сопоставить {value0}. Проверьте и выберите устройства вручную; эфир останется выключенным.",
  "Разрешите доступ к камере и микрофону, затем повторите: {message}",
  "Не удалось переключить вывод: {error}",
  "Не удалось выполнить команду студии: {value0}",
  "{value0} логических потоков (модель скрыта браузером)",
  "Не удалось переключить устройство: {message}",
  "Не удалось восстановить устройство: {message}",
  "Проверьте устройства вручную: {value0}.",
  "Подготовлено замеров аудио: {value0}…",
  "Аудиоистория выгружена: {value0} замеров за выбранный период и фильтры.",
  "Выгружена часть истории: {value0} замеров. Достигнут лимит файла; выберите отдельную сессию или более короткий период для полной выгрузки."
] as const;

const workspaceMessagePatterns = workspaceMessageTemplates.map(source => {
  const names: string[] = [];
  let pattern = "", cursor = 0;
  for (const match of source.matchAll(/\{(\w+)\}/g)) {
    pattern += source.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([\\s\\S]*?)";
    names.push(match[1]);
    cursor = match.index! + match[0].length;
  }
  pattern += source.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { source, names, pattern: new RegExp("^" + pattern + "$") };
});

export function translateWorkspaceMessage(t: Translator, message: string): string {
  for (const template of workspaceMessagePatterns) {
    const match = message.match(template.pattern);
    if (!match) continue;
    const params: Record<string, string> = {};
    template.names.forEach((name, index) => {
      const value = match[index + 1];
      // These templates interpolate literal device names or a browser thread count.
      if (template.source.startsWith("Проверьте устройства вручную") || template.source.startsWith("{value0} логических")) params[name] = value;
      else if (template.source.startsWith("Не удалось однозначно сопоставить")) params[name] = value.split(" и ").map(part => t(part)).join(t(" и "));
      else params[name] = t(value);
    });
    return t(template.source, params);
  }
  return t(message);
}
