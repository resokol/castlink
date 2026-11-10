// Production editor and chrome, with local canvas tracks instead of an SFU.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Room } from 'livekit-client';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { AppChrome, AppFooterSlot } from '@/components/AppChrome';
import { BrandIcon } from '@/components/BrandIcon';
import MultiviewEditor from '@/components/multiview/MultiviewEditor';
import styles from '@/components/multiview/MultiviewEditor.module.css';

function Fixture() {
  const [open, setOpen] = useState(true);
  const [room] = useState(() => {
    const value = new Room();
    Object.defineProperty(value, 'state', { value: 'connected' });
    for (let i = 0; i < 4; i++) {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const context = canvas.getContext('2d')!;
      context.fillStyle = ['#315354', '#4f405c', '#665333', '#365944'][i]; context.fillRect(0, 0, 640, 360);
      context.fillStyle = '#edf1ee'; context.font = '48px sans-serif'; context.fillText(`Кастер ${i + 1}`, 48, 190);
      const stream = canvas.captureStream(5);
      const track = { mediaStreamTrack: stream.getVideoTracks()[0], attach(video: HTMLVideoElement) { video.srcObject = stream; void video.play(); }, detach(video: HTMLVideoElement) { video.srcObject = null; } };
      value.remoteParticipants.set(`guest-${i + 1}`, { identity: `guest-${i + 1}`, name: ['Александр — ведущий эфира', 'Мария', 'Дмитрий', 'Анна'][i], metadata: '{"role":"guest"}', getTrackPublication: () => ({ track, isMuted: false }) } as never);
    }
    return value;
  });
  useEffect(() => { Object.assign(window, { qaStyles: styles }); return () => { room.remoteParticipants.forEach(p => p.getTrackPublication('camera' as never)?.track?.mediaStreamTrack.stop()); }; }, [room]);
  return <main className="media-page studio-page studio-app-shell graphite-workspace studio-console" data-workspace-tab="multiview">
    <aside className="studio-sidebar"><div className="studio-brand"><BrandIcon className="studio-brand-mark"/><span><strong>CastLink</strong><small>LIVE PRODUCTION</small></span></div><nav className="studio-tabs" aria-label="Раздел студии">{['Студия', 'Участники', 'Чат', 'Мультивью', 'Статистика', 'Резервные сервера', 'Настройки комнаты'].map(name => <button key={name} aria-pressed={name === 'Мультивью'} onClick={name === 'Мультивью' ? () => setOpen(true) : undefined}>{name}</button>)}</nav><div className="sidebar-room-card"><small>АКТИВНАЯ КОМНАТА</small><strong>tester</strong><span className="sidebar-live-status"><i/>Подключено</span></div><button className="sidebar-leave-button">Выйти из комнаты</button></aside>
    <div className="studio-main-column" data-studio-role="primary"><header className="studio-header"><div><p className="muted studio-workspace-eyebrow">РАБОЧАЯ СТУДИЯ</p><h1>Тестовая студия</h1></div><div className="status-pill"><span className="studio-role-badge studio-role-primary">Основная студия</span>Подключено</div></header>{open && <MultiviewEditor room={room} studioId="studio-default" roomName="tester" viewAccess="fixture-view-token" onClose={() => setOpen(false)}/>}<AppFooterSlot/></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<PathnameContext.Provider value="/"><AppChrome><Fixture/></AppChrome></PathnameContext.Provider>);
