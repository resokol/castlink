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
import {STUDIO_PLAYBACK_TITLE,useStudioPlaybackLayout} from '@/lib/studio-playback-layout';
import { ModeratorStudioMonitoring } from '@/components/ModeratorStudioMonitoring';
import { RoomInviteButton } from '@/components/RoomInviteButton';
import { StudioStreamInviteButton } from '@/components/StudioStreamInviteButton';
import { AudioMeter } from '@/components/AudioMeter';
import { BrandIcon } from '@/components/BrandIcon';
import { SourceRoster } from '@/components/SourceRoster';
import { StudioDeviceControlPanel } from '@/components/StudioDeviceControlPanel';

const noop = () => {};
function Video({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas'); const portrait = name === STUDIO_PLAYBACK_TITLE && new URLSearchParams(location.search).has('portrait'); canvas.width = portrait ? 360 : 640; canvas.height = portrait ? 640 : 360;
    const context = canvas.getContext('2d')!; context.scale(canvas.width / 640, canvas.height / 360);
    context.fillStyle = '#293a3e'; context.fillRect(0, 0, 640, 360);
    if (name === STUDIO_PLAYBACK_TITLE) {
      ['#c3c3c3','#c4c400','#00c4c4','#00c400','#c400c4','#c40000','#0000c4'].forEach((color, i) => {
        context.fillStyle = color; context.fillRect(i * 640 / 7, 0, 640 / 7 + 1, 270);
      });
      ['#002343','#ffffff','#30104f','#111111'].forEach((color, i) => {
        context.fillStyle = color; context.fillRect(i * 160, 270, 160, 90);
      });
    } else {
      const image = new Image(); image.src = '/preview-faces.webp'; image.onload = () => { const n = (Number(name.replace(/\D/g, '')) - 1) % 9; context.drawImage(image, (n % 3) * image.width / 3, Math.floor(n / 3) * image.height / 3, image.width / 3, image.height / 3, 0, 0, 640, 360); ref.current!.dataset.qaFrame='ready'; (ref.current!.srcObject as MediaStream)?.getVideoTracks().forEach(track=>(track as CanvasCaptureMediaStreamTrack).requestFrame?.()); }; image.onerror=()=>{ref.current!.dataset.qaFrame='ready';}; context.fillStyle = '#eef0f2'; context.font = '30px sans-serif'; context.fillText(name, 30, 180);
    }
    const stream = canvas.captureStream(10), video = ref.current!;
    video.srcObject = stream; void video.play();
    return () => { stream.getTracks().forEach(track => track.stop()); video.srcObject = null; };
  }, [name]);
  return <video ref={ref} className={className} autoPlay playsInline muted aria-label={name}/>;
}

function Fixture() {
  const params = new URLSearchParams(location.search), view = params.get('view') || 'scene';
  const { setLocale } = useI18n();
  const [room] = useState(() => new Room());
  const playbackSectionRef=useRef<HTMLElement>(null);
  const [studioActive,setStudioActive]=useState(true);
  const [moderator,setModerator]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [selected,setSelected]=useState('guest-0');
  const [onAir,setOnAir]=useState(false);
  const [quality,setQuality]=useState({fps:60,bitrate:12000});
  useEffect(()=>{Object.assign(window,{qaSetModerator:setModerator});},[]);
  useStudioPlaybackLayout(playbackSectionRef,view==='studio'&&studioActive);
  useEffect(()=>{Object.assign(window,{qaSetStudioActive:setStudioActive});},[]);
  const [count, setCount] = useState(Number(params.get('count') || 5));
  useEffect(() => { Object.assign(window, { qaSetCount: setCount, qaSetLocale: setLocale }); }, [setLocale]);
  if (view === 'preflight') return <GuestAvCheck name="Мария Орлова" initialChoices={{ videoEnabled: false, audioEnabled: false, height: 1080, micGain: 100, listenGain: 100 }} onJoin={noop}/>;
  if (view === 'scene') return <main style={{ height: '100dvh', padding: 12, boxSizing: 'border-box' }}>
    <ConferenceScene items={Array.from({ length: count }, (_, i) => ({ id: 'cam-' + i, identity: 'guest-' + i, kind: 'camera' as const, node: <Video name={'Кастер ' + (i + 1)}/> }))}/>
  </main>;
  const guest = (i: number) => ({ identity: 'guest-' + i, name: ['Александр','Мария','Дмитрий','Анна','Игорь','Екатерина','Михаил'][i%7] + (params.has('long') ? ' — участник с очень длинным именем' : ''), resolution: '1920×1080', bitrateKbps: 4000, packetLoss: 0, jitterMs: 1, rttMs: 10, stability: 'Хорошая' as const, camera: true, microphone: true, cpu: 'Intel Core', gpu: 'GPU', cameraDevice: 'Logitech Brio', platform: 'Windows', sampleRate: 48000 });
  return <main className="media-page studio-page studio-app-shell graphite-workspace" data-workspace-tab={studioActive?'studio':'participants'}><aside className="studio-sidebar">
    <div className="studio-brand"><BrandIcon className="studio-brand-mark"/><span><strong>CastLink</strong><small>LIVE PRODUCTION</small></span></div>
    <nav className="studio-tabs" aria-label="Раздел студии">
      <button aria-pressed={studioActive} onClick={()=>setStudioActive(true)}><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Студия</button>
      <button aria-pressed={!studioActive} onClick={()=>setStudioActive(false)}><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 21v-4a6 6 0 0112 0v4M17 5a3 3 0 010 6"/></svg>Участники</button>
      <button><svg viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4V4Z"/></svg>Чат</button>
      <button><svg viewBox="0 0 24 24"><path d="M4 3v18h17M7 16l4-6 4 3 5-8"/></svg>Статистика</button>
      <button><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/></svg>Резервные сервера</button>
    </nav>
    <div className="sidebar-room-card"><small>АКТИВНАЯ КОМНАТА</small><strong>Тестовая студия</strong><span className="sidebar-live-status"><i/>Подключено</span></div>
    <div className="sidebar-footer"><BrandIcon className="studio-brand-mark"/><span><strong>Studio Panel</strong><small>{count} гостей в комнате</small></span></div>
    <button className="sidebar-leave-button">Выйти из комнаты</button>
    </aside><div className="studio-main-column" data-studio-role={moderator?"moderator":"primary"}><header className="studio-header"><div><p className="muted studio-workspace-eyebrow">РАБОЧАЯ СТУДИЯ</p><h1>Тестовая студия</h1></div><div className="status-pill"><button className="button-secondary studio-header-multiview">Мультивью</button><button className="studio-room-menu-toggle"><span aria-hidden="true" className="studio-room-menu-icon">☰</span><span>Комната</span><span className="studio-room-menu-count">1</span></button><span className="studio-role-badge studio-role-primary">Основная студия</span>Подключено</div></header>
    {params.has('notice')&&<p className="studio-only-notice room-mode-notice">Студия включила только свой просмотр</p>}
    <div className="studio-return-layout" data-view={studioActive?"studio":"participants"}><section ref={playbackSectionRef} className="studio-return-section" hidden={!studioActive}><div className="studio-return-hero"><h2 className="studio-return-heading">{STUDIO_PLAYBACK_TITLE} <span className={`air-state ${onAir?"air-live":""}`}><i className="air-dot"/>{onAir?"ON AIR":"OFF AIR"}</span></h2>
      <div className="panel studio-video-card studio-return-preview-card"><div className="studio-playback-monitor"><div className="studio-playback-stage"><Video name={STUDIO_PLAYBACK_TITLE} className="return-preview"/></div><div className="return-audio-meter studio-preview-meter"><AudioMeter db={-18} label={STUDIO_PLAYBACK_TITLE}/></div></div><div className="studio-playback-controls"><div className="studio-transport-bar"><StudioReturnPublishingControls outputMuted={false} onToggleOutputMuted={noop} studioOnly={false} modeBusy={false} role="primary" hasSession onAir={onAir} airBusy={false} onToggleStudioOnly={noop} onToggleOnAir={()=>setOnAir(v=>!v)} screenShare={<ScreenShareButton room={room} compact/>}/><button className="button-secondary studio-settings-toggle" aria-expanded={settingsOpen} aria-controls="studio-settings" onClick={()=>setSettingsOpen(v=>!v)}>Настройки</button></div>
        <div className="studio-settings studio-device-settings" id="studio-settings" hidden={!settingsOpen}><div className="panel studio-device-panel"><label>Источник видео студии<select><option>Камера / видеоустройство</option><option>Чёрный фон</option></select></label><StudioDeviceControlPanel role={moderator?'moderator':'primary'} room={room} disabledInputs={false} outputRequestKey={0} remoteActual={null} remoteOnline={true} remoteDisabled={false} onDevicesChanged={noop} onOutputStatus={noop} onLocalChange={noop} onRemoteChange={noop}/></div></div>
</div><section className="studio-invite-compact"><div className="guest-invite-slot"><RoomInviteButton roomName="tester"/></div><div className="stream-invite-slot"><StudioStreamInviteButton roomName="tester"/></div><small className="invite-extra">Зрителей отдельного потока: 0</small></section></div>
      <div className="studio-return-rail">        <StudioReturnStatsPanel role="primary" statusText="" hasSample stats={{ resolution: '1920×1080', videoKbps: 4000, audioKbps: 128, fps: 60 }} bitratePoints="38,180 100,140 180,160 299,120" historyLength={4} clientReady airBusy={false} fps={quality.fps as 60} bitrate={quality.bitrate} videoCodec="h264" studioControlError="" controlPollError="" controlHeartbeatError="" monitoringControls={moderator?<ModeratorStudioMonitoring value={{audio:true,video:true,volume:75}} onChange={noop}/>:undefined} onQualityChange={(fps,bitrate)=>setQuality({fps,bitrate})}/>
      </div></div></section>
      <section className="studio-video-section studio-sources-section" data-source-count={count} data-view={studioActive?'studio':'participants'} aria-label="Видео гостей"><div className="workspace-section-heading"><h2>Источники <span>{count}</span></h2><span>Индивидуальные выходы · видео + аудио</span></div><div className="source-browser" data-view={studioActive?'studio':'participants'}><SourceRoster sources={Array.from({length:count},(_,i)=>({key:'guest-'+i,identity:'guest-'+i,name:guest(i).name,kind:'camera' as const,role:'Гость'}))} selected={selected} onSelect={setSelected}/><section className="studio-video-wall studio-production-wall source-deck">
        {Array.from({ length: count }, (_, i) => <GuestVideoCard key={i} guest={guest(i)} focused={selected===guest(i).identity} onSelect={()=>setSelected(guest(i).identity)} roomName="fixture" outputUrl="#" copied={false} receiveBitrate={4000} preference={{ audio: true, video: true, volume: 75 }} onCopy={noop} onQualityChange={noop} onMonitoringChange={noop} preview={<div className="guest-preview-cell"><div className="studio-guest-video-wrap"><div className="remote-video-preview"><div className="remote-video-source"><Video name={'Кастер ' + (i + 1)}/></div></div></div></div>} meter={<AudioMeter db={-20} label="Микрофон"/>} quickControls={<><button>Выключить микрофон гостя</button><button>Выключить камеру гостя</button></>} mediaControls={<div className="studio-guest-media-controls"><label>Камера<select><option>Logitech Brio — длинное название</option></select></label><label>Микрофон<select><option>Основной микрофон</option></select></label></div>}/>)}
      </section></div></section>
    </div></div></main>;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><Fixture/></I18nProvider>);
