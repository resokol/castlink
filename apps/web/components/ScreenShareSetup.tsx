/** Installation is an explicit download. A failed protocol launch cannot prove
 * whether a component is installed; only the paired sharing session does. */
export function ScreenShareSetup({locale,busy,onRetry,onCancel}:{locale:string;busy:boolean;onRetry():void;onCancel():void}){
  const text=locale==='en'?{
    help:'Choose a screen or window in the CastLink component. If it did not open, install the sharing component once. The full client is not required.',
    install:'Download sharing component',next:'After installing, return here and press “Start sharing”. Your browser may ask to open CastLink. The component closes when sharing stops.',
    retry:'Start sharing',cancel:'Cancel and share without PC control'
  }:locale==='zh-CN'?{
    help:'请在 CastLink 组件中选择屏幕或窗口。如未打开，请先安装一次共享组件，无需安装完整客户端。',
    install:'下载共享组件',next:'安装后返回此处并点击“开始共享”。浏览器可能会请求打开 CastLink。共享停止后，组件将退出。',
    retry:'开始共享',cancel:'取消并在不授予电脑控制权的情况下共享'
  }:{
    help:'Выберите экран или окно в компоненте CastLink. Если окно не открылось, один раз установите компонент демонстрации. Полный клиент не требуется.',
    install:'Скачать компонент демонстрации',next:'После установки вернитесь сюда и нажмите «Начать показ». Браузер может запросить открытие CastLink. После остановки показа компонент завершится.',
    retry:'Начать показ',cancel:'Отменить и показывать без управления ПК'
  };
  return <div className="screen-share-component-setup" role="status">
    <p>{text.help}</p>
    <a className="button-secondary" href="https://castlink.ru/general/screen-share-component/CastLink-Screen-Share-Setup.exe" download rel="noreferrer">{text.install}</a>
    <p>{text.next}</p>
    <button type="button" className="button-secondary" disabled={busy} onClick={onRetry}>{text.retry}</button>
    <button type="button" className="button-secondary" disabled={busy} onClick={onCancel}>{text.cancel}</button>
  </div>;
}
