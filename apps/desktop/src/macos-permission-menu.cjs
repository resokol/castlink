'use strict';

// Every action comes from this main-process list. Neither menu click arguments
// nor renderer-provided kinds/URLs are forwarded to the permission adapter.
const KINDS = Object.freeze(['screen', 'accessibility', 'microphone', 'camera', 'automation', 'input-monitoring']);
const COPY = {
  en: {
    label: 'macOS Permissions…', title: 'CastLink — macOS Permissions',
    overview: 'Permissions for calls, sharing and remote control',
    names: ['Screen Recording', 'Accessibility', 'Microphone', 'Camera', 'Automation', 'Input Monitoring'],
    allowed: 'Allowed', denied: 'Not allowed', unknown: 'Unavailable', target: 'Checked for each target app',
    done: 'Done', back: 'Back', recheck: 'Recheck', action: 'Request / Open Settings',
    note: 'Choose a permission to see instructions. Permissions are requested only when you choose the action below. After changing macOS settings, use Recheck.',
    failed: 'Could not complete the request. Check System Settings and try again.',
    guidance: [
      'Screen Recording lets CastLink share a selected display or window. Enable CastLink under System Settings → Privacy & Security → Screen & System Audio Recording (Screen Recording on older macOS). macOS may require you to quit and reopen CastLink. Opening settings does not grant permission.',
      'Accessibility lets CastLink send keyboard and pointer input during an explicitly approved remote-control session. Enable CastLink under System Settings → Privacy & Security → Accessibility. This permission alone does not start remote control.',
      'Microphone access lets CastLink send your chosen microphone during a call. Allow the macOS prompt, or enable CastLink under System Settings → Privacy & Security → Microphone if previously denied.',
      'Camera access lets CastLink send your chosen camera during a call. Allow the macOS prompt, or enable CastLink under System Settings → Privacy & Security → Camera if previously denied.',
      'Automation permission is separate for each controlled app, such as PowerPoint or Keynote. macOS asks when you first use a presentation action for that app. Enable the specific target under CastLink in System Settings → Privacy & Security → Automation. Opening settings or granting Accessibility does not authorize a target app.',
      'Input Monitoring lets CastLink detect local keyboard and pointer activity so you can stop or pause remote control locally. Enable the packaged CastLink helper in System Settings → Privacy & Security → Input Monitoring, then quit and reopen CastLink if macOS requires it. Accessibility does not grant Input Monitoring; both are checked independently.',
    ],
  },
  ru: {
    label: 'Разрешения macOS…', title: 'CastLink — Разрешения macOS',
    overview: 'Разрешения для звонков, трансляции и удалённого управления',
    names: ['Запись экрана', 'Универсальный доступ', 'Микрофон', 'Камера', 'Автоматизация', 'Мониторинг ввода'],
    allowed: 'Разрешено', denied: 'Не разрешено', unknown: 'Недоступно', target: 'Проверяется для каждого приложения',
    done: 'Готово', back: 'Назад', recheck: 'Проверить снова', action: 'Запросить / Открыть настройки',
    note: 'Выберите разрешение, чтобы открыть инструкцию. Системный запрос появится только после выбора действия. После изменения настроек macOS нажмите «Проверить снова».',
    failed: 'Не удалось выполнить запрос. Проверьте системные настройки и повторите попытку.',
    guidance: [
      'Запись экрана позволяет CastLink транслировать выбранный экран или окно. Включите CastLink в разделе «Системные настройки → Конфиденциальность и безопасность → Запись экрана и системного аудио» («Запись экрана» в старых версиях macOS). macOS может потребовать перезапуск CastLink. Открытие настроек не предоставляет разрешение.',
      'Универсальный доступ позволяет CastLink отправлять нажатия клавиш и действия указателя в явно одобренном сеансе удалённого управления. Включите CastLink в разделе «Системные настройки → Конфиденциальность и безопасность → Универсальный доступ». Само разрешение не запускает удалённое управление.',
      'Доступ к микрофону позволяет передавать звук выбранного микрофона во время звонка. Подтвердите системный запрос macOS. Если ранее вы отказали, включите CastLink в разделе «Системные настройки → Конфиденциальность и безопасность → Микрофон».',
      'Доступ к камере позволяет передавать видео выбранной камеры во время звонка. Подтвердите системный запрос macOS. Если ранее вы отказали, включите CastLink в разделе «Системные настройки → Конфиденциальность и безопасность → Камера».',
      'Разрешение на автоматизацию выдаётся отдельно для каждого управляемого приложения, например PowerPoint или Keynote. macOS показывает запрос при первом действии с презентацией в этом приложении. Включите нужное приложение в строке CastLink в разделе «Системные настройки → Конфиденциальность и безопасность → Автоматизация». Открытие настроек и Универсальный доступ не дают разрешения на управление приложением.',
      'Мониторинг ввода позволяет CastLink обнаруживать локальные нажатия клавиш и действия указателя, чтобы вы могли остановить или приостановить удалённое управление на этом компьютере. Включите компонент CastLink в разделе «Системные настройки → Конфиденциальность и безопасность → Мониторинг ввода». Если macOS попросит, перезапустите CastLink. Универсальный доступ не предоставляет мониторинг ввода: эти разрешения проверяются отдельно.',
    ],
  },
  zh: {
    label: 'macOS 权限…', title: 'CastLink — macOS 权限',
    overview: '通话、共享和远程控制所需权限',
    names: ['屏幕录制', '辅助功能', '麦克风', '摄像头', '自动化', '输入监控'],
    allowed: '已允许', denied: '未允许', unknown: '不可用', target: '按目标应用单独检查',
    done: '完成', back: '返回', recheck: '重新检查', action: '请求权限 / 打开设置',
    note: '选择权限以查看说明。只有点击操作按钮才会请求系统权限。更改 macOS 设置后，请点击“重新检查”。',
    failed: '无法完成请求。请检查系统设置后重试。',
    guidance: [
      '屏幕录制权限允许 CastLink 共享所选显示器或窗口。请在“系统设置 → 隐私与安全性 → 屏幕与系统音频录制”（旧版 macOS 为“屏幕录制”）中启用 CastLink。macOS 可能要求退出并重新打开 CastLink。打开设置不会授予权限。',
      '辅助功能权限允许 CastLink 在您明确同意的远程控制会话中发送键盘和指针输入。请在“系统设置 → 隐私与安全性 → 辅助功能”中启用 CastLink。此权限本身不会启动远程控制。',
      '麦克风权限允许 CastLink 在通话中发送所选麦克风的声音。请允许 macOS 权限请求。如果之前已拒绝，请在“系统设置 → 隐私与安全性 → 麦克风”中启用 CastLink。',
      '摄像头权限允许 CastLink 在通话中发送所选摄像头的视频。请允许 macOS 权限请求。如果之前已拒绝，请在“系统设置 → 隐私与安全性 → 摄像头”中启用 CastLink。',
      '自动化权限按受控应用单独授予，例如 PowerPoint 或 Keynote。首次对该应用执行演示操作时，macOS 会请求权限。请在“系统设置 → 隐私与安全性 → 自动化”的 CastLink 条目下启用相应应用。打开设置或授予辅助功能权限均不会授权目标应用。',
      '输入监控允许 CastLink 检测本机键盘和指针活动，以便您在本机停止或暂停远程控制。请在“系统设置 → 隐私与安全性 → 输入监控”中启用随 CastLink 安装的辅助程序；如果 macOS 要求，请退出并重新打开 CastLink。辅助功能权限不会授予输入监控权限，两者会分别检查。',
    ],
  },
};

function createMacPermissionMenu({ adapter, dialog, getWindow = () => null, getLocale = () => 'en' }) {
  if (!adapter || typeof adapter.status !== 'function' || typeof adapter.request !== 'function') {
    throw new TypeError('A macOS permission adapter is required');
  }
  if (!dialog || typeof dialog.showMessageBox !== 'function') throw new TypeError('A native dialog is required');
  let active = false;
  function copy() {
    const locale = String(getLocale() || 'en').toLowerCase();
    return COPY[locale.startsWith('ru') ? 'ru' : locale.startsWith('zh') ? 'zh' : 'en'];
  }
  function statusText(kind, text) {
    // There is deliberately no global “Automation granted” status.
    if (kind === 'automation') return text.target;
    try {
      const current = adapter.status(kind);
      if (current && current.granted === true) return text.allowed;
      if (!current || /(?:unavailable|failed|unknown)$/.test(current.reason || '')) return text.unknown;
      return text.denied;
    } catch { return text.unknown; }
  }
  function show(text, options) {
    const win = getWindow();
    const config = { type: 'info', title: text.title, noLink: true, ...options };
    return win && !(typeof win.isDestroyed === 'function' && win.isDestroyed())
      ? dialog.showMessageBox(win, config) : dialog.showMessageBox(config);
  }
  return {
    label: copy().label,
    async click() {
      if (active) return;
      active = true;
      try {
        while (true) {
          const text = copy();
          const result = await show(text, {
            message: text.overview,
            detail: `${KINDS.map((kind, index) => `${text.names[index]}: ${statusText(kind, text)}`).join('\n')}\n\n${text.note}`,
            buttons: [...text.names, text.done], defaultId: KINDS.length, cancelId: KINDS.length,
          });
          const index = result && result.response;
          if (!Number.isInteger(index) || index < 0 || index >= KINDS.length) return;
          const kind = KINDS[index];
          let failed = false;
          while (true) {
            const detail = await show(text, {
              message: text.names[index],
              detail: `${statusText(kind, text)}\n\n${text.guidance[index]}${failed ? `\n\n${text.failed}` : ''}`,
              buttons: [text.action, text.recheck, text.back], defaultId: 2, cancelId: 2,
            });
            if (!detail || (detail.response !== 0 && detail.response !== 1)) break;
            failed = false;
            if (detail.response === 0) {
              try { await adapter.request(kind); } catch { failed = true; }
              // Ignore the request result. Read the OS again after the await;
              // a settings visit or completed prompt is never proof of a grant.
            }
          }
        }
      } catch {
        // Closing a parent window can reject its dialog; permit a future retry.
      } finally { active = false; }
    },
  };
}

module.exports = { createMacPermissionMenu };
