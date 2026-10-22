import type { Locale } from "@/lib/i18n";

const messages: Record<string, readonly [string, string]> = {
  "Запомнить меня": ["Remember me", "记住我"],
  "Проверьте себя перед входом": ["Check your setup before joining", "加入前检查设备"],
  "Ваше имя и устройства": ["Your name and devices", "您的姓名和设备"],
  "Как вас представить": ["Your display name", "您的显示名称"],
  "Это имя увидят участники студии.": ["Studio participants will see this name.", "演播室参与者会看到此姓名。"],
  "Предпросмотр · только вы": ["Preview · only you", "预览 · 仅自己可见"],
  "Камера выключена": ["Camera is off", "摄像头已关闭"],
  "Ожидаем камеру…": ["Waiting for camera…", "正在等待摄像头…"],
  "Выключить камеру": ["Turn camera off", "关闭摄像头"],
  "Включить камеру": ["Turn camera on", "开启摄像头"],
  "Выключить микрофон": ["Turn microphone off", "关闭麦克风"],
  "Включить микрофон": ["Turn microphone on", "开启麦克风"],
  "Микрофон": ["Microphone", "麦克风"],
  "Микрофон выключен": ["Microphone is off", "麦克风已关闭"],
  "Уровень": ["Level", "音量"],
  "До подключения студия не получает ваши видео и звук. При запросе разрешите доступ к устройствам.": ["Your video and audio stay private until you connect. Allow access to your devices when prompted.", "连接前，演播室不会接收您的视频和音频。出现提示时，请允许访问设备。"],
  "Проверить звук": ["Test sound", "测试声音"],
  "Остановить звук": ["Stop sound", "停止声音"],
  "Подключиться к студии": ["Connect to studio", "连接演播室"],
  "Подключение начнётся после нажатия кнопки.": ["You will connect after pressing the button.", "点击按钮后才会开始连接。"],
  "Дополнительные настройки": ["Advanced settings", "高级设置"],
  "Назад к приглашению": ["Back to invitation", "返回邀请"],
};

export function preflightMessage(locale: Locale, source: string): string {
  return locale === "ru" ? source : messages[source]?.[locale === "en" ? 0 : 1] || source;
}
