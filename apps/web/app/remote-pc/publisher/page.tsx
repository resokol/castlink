'use client';
import {useEffect, useRef, useState} from 'react';
import {startRemotePublisher} from '@/lib/remote-pc-publisher';
export default function RemotePcPublisherPage() {
  const [status, setStatus] = useState('Выберите экран или окно в компоненте CastLink.');
  const stop = useRef<(() => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    const bridge = window.castlinkRemotePublisher;
    if (!bridge) { setStatus('Откройте демонстрацию кнопкой в комнате CastLink.'); return; }
    let cancelled = false, started = false;
    const timer = setTimeout(() => { started = true; void startRemotePublisher(bridge, setStatus).then(value => { if (cancelled) void value(); else stop.current = value; }).catch(() => setStatus('Не удалось начать показ. Повторите действие в комнате CastLink.')); }, 0);
    return () => { cancelled = true; clearTimeout(timer); if (stop.current) void stop.current(); else if (started) void bridge.stop(); };
  }, []);
  return <main style={{padding:24,maxWidth:560,fontFamily:'system-ui'}}><h1 style={{fontSize:24}}>Демонстрация экрана</h1><p role="status">{status}</p><p>Остановка: Ctrl + Alt + Shift + F12</p><button onClick={() => { void (stop.current ? stop.current() : window.castlinkRemotePublisher?.stop()); }}>Остановить демонстрацию</button></main>;
}
