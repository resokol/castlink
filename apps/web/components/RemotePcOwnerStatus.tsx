'use client';
import { useSyncExternalStore } from 'react';
import type { Room } from 'livekit-client';
import { remotePcDesktopStatus, subscribeRemotePcDesktop } from '@/lib/remote-pc-desktop';
import { useI18n } from './I18nProvider';
export function RemotePcOwnerStatus({ room }: {
    room: Room;
}) {
    const { locale } = useI18n(), status = useSyncExternalStore(listener => subscribeRemotePcDesktop(room, listener), () => remotePcDesktopStatus(room), () => remotePcDesktopStatus(room));
    const text = locale === 'en' ? { title: 'PC control', restart: 'PC control is unavailable. Stop and restart screen sharing to select the source again. Video and audio continue.', update: 'To give PC control, share through an updated CastLink Windows client. Ordinary screen sharing remains available.', ready: 'Use the floating screen toolbar to give or reclaim full PC mouse and keyboard control. Control is not limited to the shared window.' } : locale === 'zh-CN' ? { title: '电脑控制', restart: '电脑控制不可用。请停止并重新共享屏幕，再次选择来源。视频和音频仍在继续。', update: '要授予电脑控制权，请使用最新的 CastLink Windows 客户端共享。普通屏幕共享仍可使用。', ready: '使用浮动共享工具栏授予或收回整台电脑的鼠标和键盘控制权。控制权限不限于共享窗口。' } : { title: 'Управление ПК', restart: 'Управление ПК недоступно. Остановите и начните показ снова, выбрав источник повторно. Видео и звук продолжаются.', update: 'Чтобы передать управление ПК, показывайте экран через обновлённый Windows-клиент CastLink. Обычный показ экрана доступен.', ready: 'Передайте или заберите полный доступ к мыши и клавиатуре ПК в плавающей панели показа. Управление не ограничено выбранным окном.' };
    return <details className="remote-pc-owner-status" open={status.restart || undefined}><summary>{text.title}</summary><p role={status.restart ? 'alert' : undefined}>{status.restart ? text.restart : status.supported ? text.ready : text.update}</p></details>;
}
