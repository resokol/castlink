// Actual UI components with local synthetic video. No network or media session.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Room } from 'livekit-client';
import { I18nProvider, useI18n } from '@/components/I18nProvider';
import { ConferenceScene } from '@/components/ConferenceScene';
import { GuestVideoCard } from '@/components/GuestVideoCard';
import { StudioReturnStatsPanel } from '@/components/StudioReturnStatsPanel';
import { StudioReturnPublishingControls } from '@/components/StudioReturnPublishingControls';
import { ScreenShareButton } from '@/components/ScreenShareButton';
import { GuestAvCheck } from '@/components/GuestAvCheck';
import { AudioMeter } from '@/components/AudioMeter';

const noop = () => {};
function Video({ name }: { name: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#293a3e'; context.fillRect(0, 0, 640, 360);
    context.fillStyle = '#eef0f2'; context.font = '30px sans-serif'; context.fillText(name, 30, 180);
    const stream = canvas.captureStream(10), video = ref.current!;
    video.srcObject = stream; void video.play();
    return () => { stream.getTracks().forEach(track => track.stop()); video.srcObject = null; };
  }, [name]);
  return <video ref={ref} autoPlay playsInline muted aria-label={name}/>;
}

function Fixture() {
  const params = new URLSearchParams(location.search), view = params.get('view') || 'scene';
  const { setLocale } = useI18n();
  const [room] = useState(() => new Room());
  const [count, setCount] = useState(Number(params.get('count') || 3));
  useEffect(() => { Object.assign(window, { qaSetCount: setCount, qaSetLocale: setLocale }); }, [setLocale]);
  if (view === 'preflight') return <GuestAvCheck name="Мария Орлова" initialChoices={{ videoEnabled: false, audioEnabled: false, height: 1080, micGain: 100, listenGain: 100 }} onJoin={noop}/>;
  if (view === 'scene') return <main style={{ height: '100dvh', padding: 12, boxSizing: 'border-box' }}>
    <ConferenceScene items={Array.from({ length: count }, (_, i) => ({ id: 'cam-' + i, identity: 'guest-' + i, kind: 'camera' as const, node: <Video name={'Кастер ' + (i + 1)}/> }))}/>
  </main>;
  const guest = (i: number) => ({ identity: 'guest-' + i, name: i ? 'Кастер ' + i : 'Александр — длинное имя', resolution: '1920×1080', bitrateKbps: 4000, packetLoss: 0, jitterMs: 1, rttMs: 10, stability: 'Хорошая' as const, camera: true, microphone: true, cpu: 'Intel Core', gpu: 'GPU', cameraDevice: 'Logitech Brio', platform: 'Windows', sampleRate: 48000 });
  return <main className="studio-page studio-app-shell graphite-workspace"><aside className="studio-sidebar">CastLink</aside><div className="studio-main-column"><header className="studio-header"><h1>Рабочая студия</h1></header>
    <div className="studio-return-layout" data-view="studio"><section className="studio-return-section"><div className="studio-return-hero"><h2 className="studio-return-heading">Studio Return</h2>
      <div className="panel studio-video-card studio-return-preview-card"><div className="studio-preview-placeholder">Studio Return</div><section className="studio-invite-compact"><button>Пригласить гостя</button><button>Ссылка на эфир</button></section></div>
      <div className="studio-return-rail"><div className="studio-transport-bar"><StudioReturnPublishingControls outputMuted={false} onToggleOutputMuted={noop} studioOnly={false} modeBusy={false} role="primary" hasSession onAir={false} airBusy={false} onToggleStudioOnly={noop} onToggleOnAir={noop} screenShare={<ScreenShareButton room={room} compact/>}/><button className="studio-settings-toggle">Настройки</button></div>
        <StudioReturnStatsPanel role="primary" statusText="" hasSample stats={{ resolution: '1920×1080', videoKbps: 4000, audioKbps: 128, fps: 60 }} bitratePoints="38,180 100,140 180,160 299,120" historyLength={4} clientReady airBusy={false} fps={60} bitrate={10000} videoCodec="h264" studioControlError="" controlPollError="" controlHeartbeatError="" onQualityChange={noop}/>
      </div></div></section>
      <section className="studio-sources-section" data-view="studio"><h2>Видео гостей</h2><div className="source-browser" data-view="studio"><section className="studio-video-wall studio-production-wall source-deck">
        {Array.from({ length: 7 }, (_, i) => <GuestVideoCard key={i} guest={guest(i)} roomName="fixture" outputUrl="#" copied={false} receiveBitrate={4000} preference={{ audio: true, video: true, volume: 75 }} onCopy={noop} onQualityChange={noop} onMonitoringChange={noop} preview={<div className="guest-preview-cell"><div className="studio-guest-video-wrap"><Video name={'Кастер ' + (i + 1)}/></div></div>} meter={<AudioMeter db={-20} label="Микрофон"/>} quickControls={<><button>Микрофон</button><button>Камера</button></>} mediaControls={<div className="studio-guest-media-controls"><label>Камера<select><option>Logitech Brio — длинное название</option></select></label><label>Микрофон<select><option>Основной микрофон</option></select></label></div>}/>)}
      </section></div></section>
    </div></div></main>;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><Fixture/></I18nProvider>);
