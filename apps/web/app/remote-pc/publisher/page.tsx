'use client';
import {useEffect, useRef, useState} from 'react';
import {startRemotePublisher,type RemotePublisherControls} from '@/lib/remote-pc-publisher';
import {RemotePcFloatingControls} from '@/components/RemotePcFloatingControls';
import {useI18n} from '@/components/I18nProvider';
export default function RemotePcPublisherPage() {
  const {locale} = useI18n();
  const [status, setStatus] = useState('Выберите экран или окно в компоненте CastLink.');
  const [controls,setControls] = useState<RemotePublisherControls>();
  const stop = useRef<(() => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    const bridge = window.castlinkRemotePublisher;
    if (!bridge) { setStatus('Откройте демонстрацию кнопкой в комнате CastLink.'); return; }
    let cancelled = false, started = false;
    const timer = setTimeout(() => { started = true; void startRemotePublisher(bridge, value => { if (!cancelled) setStatus(value); },value => { if (!cancelled) setControls(value); }).then(value => { if (cancelled) void value(); else stop.current = value; }).catch(() => { if (!cancelled) setStatus('Не удалось начать показ. Повторите действие в комнате CastLink.'); }); }, 0);
    return () => { cancelled = true; clearTimeout(timer); if (stop.current) void stop.current(); else if (started) void bridge.stop(); };
  }, []);
  return <main style={{margin:0,padding:0,maxWidth:'none'}}><RemotePcFloatingControls controls={controls} locale={locale} status={status} onStop={() => stop.current ? stop.current() : window.castlinkRemotePublisher?.stop()} /></main>;
}
