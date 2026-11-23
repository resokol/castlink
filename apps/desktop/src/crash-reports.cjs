'use strict';

const copy = {
  ru: {
    label: 'Отчёты о сбоях…',
    detail: 'CastLink сохраняет отчёты только на этом компьютере. Для обращения в поддержку выберите файл .dmp по времени сбоя. Он может содержать личные данные из памяти приложения.',
    open: 'Открыть папку',
    close: 'Закрыть',
    error: 'Не удалось открыть папку с отчётами.',
  },
  en: {
    label: 'Crash reports…',
    detail: 'CastLink keeps crash reports on this computer. If you choose to contact support, look for a .dmp file from the time of the crash. It may contain personal information from application memory.',
    open: 'Open folder',
    close: 'Close',
    error: 'Could not open the crash reports folder.',
  },
  'zh-CN': {
    label: '崩溃报告…',
    detail: 'CastLink 仅在此电脑上保存崩溃报告。如需联系技术支持，请根据崩溃时间选择 .dmp 文件。该文件可能包含应用内存中的个人信息。',
    open: '打开文件夹',
    close: '关闭',
    error: '无法打开崩溃报告文件夹。',
  },
};

function menuItem({ app, dialog, shell, locale }) {
  const t = copy[locale];
  return {
    label: t.label,
    async click(_item, window) {
      const show = options => window && !window.isDestroyed()
        ? dialog.showMessageBox(window, options)
        : dialog.showMessageBox(options);
      const { response } = await show({
        type: 'info', message: t.label.replace(/…$/, ''), detail: t.detail,
        buttons: [t.close, t.open], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (response !== 1) return;
      const directory = app.getPath('crashDumps');
      if (await shell.openPath(directory).catch(() => true)) {
        await show({ type: 'warning', message: t.error, detail: directory });
      }
    },
  };
}

module.exports = { menuItem };
