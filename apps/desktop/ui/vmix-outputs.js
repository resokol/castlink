'use strict';
(() => {
  const copy = {
    ru: {
      desktop:'Desktop / Студия', language:'Язык', theme:'Тема', title:'Слоты кастеров', outputs:'Выходы для vMix', protocol:'Протокол', start:'Запустить выходы', stop:'Остановить выходы', busy:'Подождите…', senderMode:'Режим CastLink', localAddress:'Локальный IP-адрес', remoteAddress:'Адрес vMix', latency:'Задержка, мс', encryption:'Шифрование и Stream ID', passphrase:'Пароль (Passphrase)', keyLength:'Длина ключа', encryptionHelp:'Пароль: 10–79 байт UTF-8. Укажите тот же пароль и ключ в vMix.', runtime:'Компоненты и качество', browse:'Выбрать файл…', fps:'Кадров/с', bitrate:'Битрейт, Кбит/с', slot:'Слот / кастер', source:'Что передавать', receiver:'Вход в vMix', stable:'Назначайте кастеров в студии. При смене кастера вход vMix и имя слота сохраняются.', loading:'Загрузка слотов…', empty:'В студии пока нет слотов. Создайте слот в разделе «Участники».', selection:'Выберите от 1 до 4 слотов. Для изменения настроек остановите выходы.', selected:'Выбрано: {n} / 4', unassigned:'Кастер не назначен', camera:'Камера + микрофон', screen:'Экран + звук экрана', port:'UDP-порт', streamId:'Stream ID', notSelected:'Не выбран', stopped:'Остановлен', waiting:'Ожидает источник', connecting:'Подключение источника', sourceAvailable:'Источник доступен', unavailable:'Источник недоступен', revoked:'Доступ отозван', restarting:'Перезапуск', outputError:'Ошибка выхода', sourceNote:'Статус источника CastLink; приём проверьте в vMix.', include:'Передавать слот', auto:'Автоматический поиск', missing:'Файл не выбран', srtRuntime:'FFmpeg (.exe)', ndiRuntime:'NDI Runtime (.dll)', omtRuntime:'OMT Runtime (.dll)', srtRuntimeHelp:'Выберите установленный ffmpeg.exe с поддержкой SRT. Компоненты не скачиваются автоматически.', ndiRuntimeHelp:'Установленный NDI Runtime определяется автоматически. При необходимости выберите DLL вручную.', omtRuntimeHelp:'Выберите DLL установленного OMT Runtime.', srtHelp:'В vMix откройте Add Input → Stream / SRT и выберите SRT ({role}).', ndiHelp:'В vMix откройте Add Input → NDI и выберите источник по имени.', omtHelp:'В vMix 29 или новее откройте Add Input → NDI / OMT и выберите источник по имени.', castlinkIp:'IP CastLink', milliseconds:'мс', encrypted:'Шифрование включено', initError:'Не удалось загрузить слоты. Закройте и снова откройте панель.', startError:'Не удалось запустить выходы. Проверьте компоненты, настройки и доступ к слотам.', stopError:'Не удалось остановить выходы. Повторите попытку.', pickError:'Не удалось выбрать компонент. Повторите попытку.', slotsError:'Выберите от 1 до 4 слотов.', pathError:'Выберите файл компонента в разделе «Компоненты и качество».', addressError:'Укажите IP-адрес или имя узла без протокола и порта.', latencyError:'Задержка должна быть целым числом от 0 до 60000 мс.', passphraseError:'Пароль должен содержать 10–79 байт UTF-8 без управляющих символов.', portError:'Укажите разные целые UDP-порты от 1 до 65535.', streamError:'Stream ID: не более 512 байт UTF-8 без управляющих символов.', qualityError:'Выберите частоту 30, 50 или 60 кадров/с и битрейт от 500 до 25000 Кбит/с.'
    },
    en: {
      desktop:'Desktop / Studio', language:'Language', theme:'Theme', title:'Caster slots', outputs:'Outputs for vMix', protocol:'Protocol', start:'Start outputs', stop:'Stop outputs', busy:'Please wait…', senderMode:'CastLink mode', localAddress:'Local IP address', remoteAddress:'vMix address', latency:'Latency, ms', encryption:'Encryption and Stream ID', passphrase:'Passphrase', keyLength:'Key length', encryptionHelp:'Passphrase: 10–79 UTF-8 bytes. Use the same passphrase and key in vMix.', runtime:'Components and quality', browse:'Choose file…', fps:'Frames/s', bitrate:'Bitrate, Kbps', slot:'Slot / caster', source:'Source to send', receiver:'Input in vMix', stable:'Assign casters in the studio. The vMix input and slot name stay the same when the caster changes.', loading:'Loading slots…', empty:'No studio slots yet. Create a slot in Participants.', selection:'Choose 1–4 slots. Stop outputs to change settings.', selected:'Selected: {n} / 4', unassigned:'No caster assigned', camera:'Camera + microphone', screen:'Screen + screen audio', port:'UDP port', streamId:'Stream ID', notSelected:'Not selected', stopped:'Stopped', waiting:'Waiting for source', connecting:'Connecting source', sourceAvailable:'Source available', unavailable:'Source unavailable', revoked:'Access revoked', restarting:'Restarting', outputError:'Output error', sourceNote:'CastLink source status; check reception in vMix.', include:'Send slot', auto:'Automatic discovery', missing:'No file selected', srtRuntime:'FFmpeg (.exe)', ndiRuntime:'NDI Runtime (.dll)', omtRuntime:'OMT Runtime (.dll)', srtRuntimeHelp:'Choose an installed ffmpeg.exe with SRT support. Components are not downloaded automatically.', ndiRuntimeHelp:'An installed NDI Runtime is discovered automatically. Choose its DLL manually if needed.', omtRuntimeHelp:'Choose the installed OMT Runtime DLL.', srtHelp:'In vMix, open Add Input → Stream / SRT and select SRT ({role}).', ndiHelp:'In vMix, open Add Input → NDI and select the source by name.', omtHelp:'In vMix 29 or newer, open Add Input → NDI / OMT and select the source by name.', castlinkIp:'CastLink IP', milliseconds:'ms', encrypted:'Encryption enabled', initError:'Could not load slots. Close and reopen this panel.', startError:'Could not start outputs. Check components, settings and slot access.', stopError:'Could not stop outputs. Try again.', pickError:'Could not choose the component. Try again.', slotsError:'Choose 1–4 slots.', pathError:'Choose a component file under Components and quality.', addressError:'Enter an IP address or hostname without a protocol or port.', latencyError:'Latency must be a whole number from 0 to 60000 ms.', passphraseError:'Passphrase must contain 10–79 UTF-8 bytes without control characters.', portError:'Use distinct whole UDP ports from 1 to 65535.', streamError:'Stream ID must be at most 512 UTF-8 bytes without control characters.', qualityError:'Choose 30, 50 or 60 frames/s and a bitrate from 500 to 25000 Kbps.'
    },
    'zh-CN': {
      desktop:'Desktop / 演播室', language:'语言', theme:'主题', title:'主播槽位', outputs:'vMix 输出', protocol:'协议', start:'启动输出', stop:'停止输出', busy:'请稍候…', senderMode:'CastLink 模式', localAddress:'本地 IP 地址', remoteAddress:'vMix 地址', latency:'延迟（毫秒）', encryption:'加密与 Stream ID', passphrase:'密码（Passphrase）', keyLength:'密钥长度', encryptionHelp:'密码：10–79 个 UTF-8 字节。请在 vMix 中使用相同的密码和密钥。', runtime:'组件与质量', browse:'选择文件…', fps:'帧/秒', bitrate:'码率（Kbps）', slot:'槽位 / 主播', source:'发送内容', receiver:'vMix 输入', stable:'在演播室中分配主播。更换主播时，vMix 输入和槽位名称保持不变。', loading:'正在加载槽位…', empty:'演播室中暂无槽位。请在“参与者”中创建槽位。', selection:'选择 1–4 个槽位。修改设置前请停止输出。', selected:'已选：{n} / 4', unassigned:'未分配主播', camera:'摄像头 + 麦克风', screen:'屏幕 + 屏幕音频', port:'UDP 端口', streamId:'Stream ID', notSelected:'未选择', stopped:'已停止', waiting:'等待信号源', connecting:'正在连接信号源', sourceAvailable:'信号源可用', unavailable:'信号源不可用', revoked:'访问权限已撤销', restarting:'正在重启', outputError:'输出错误', sourceNote:'此为 CastLink 信号源状态；请在 vMix 中确认接收情况。', include:'发送槽位', auto:'自动检测', missing:'未选择文件', srtRuntime:'FFmpeg (.exe)', ndiRuntime:'NDI Runtime (.dll)', omtRuntime:'OMT Runtime (.dll)', srtRuntimeHelp:'选择已安装且支持 SRT 的 ffmpeg.exe。组件不会自动下载。', ndiRuntimeHelp:'自动检测已安装的 NDI Runtime。如有需要，可手动选择 DLL。', omtRuntimeHelp:'选择已安装的 OMT Runtime DLL。', srtHelp:'在 vMix 中打开 Add Input → Stream / SRT，然后选择 SRT ({role})。', ndiHelp:'在 vMix 中打开 Add Input → NDI，然后按名称选择信号源。', omtHelp:'在 vMix 29 或更高版本中打开 Add Input → NDI / OMT，然后按名称选择信号源。', castlinkIp:'CastLink IP', milliseconds:'毫秒', encrypted:'已启用加密', initError:'无法加载槽位。请关闭并重新打开此面板。', startError:'无法启动输出。请检查组件、设置及槽位访问权限。', stopError:'无法停止输出。请重试。', pickError:'无法选择组件。请重试。', slotsError:'请选择 1–4 个槽位。', pathError:'请在“组件与质量”中选择组件文件。', addressError:'请输入 IP 地址或主机名，不含协议和端口。', latencyError:'延迟必须为 0–60000 毫秒的整数。', passphraseError:'密码须为 10–79 个 UTF-8 字节，且不含控制字符。', portError:'请使用不同的 UDP 端口，范围为 1–65535 的整数。', streamError:'Stream ID 不得超过 512 个 UTF-8 字节，且不能包含控制字符。', qualityError:'请选择每秒 30、50 或 60 帧，码率为 500–25000 Kbps。'
    }
  };
  const $ = id => document.getElementById(id);
  const api = window.castlinkVmix;
  const rows = new Map();
  const roles = {listener:'Caller', caller:'Listener', rendezvous:'Rendezvous'};
  const stateKeys = {waiting:'waiting', connecting:'connecting', source:'sourceAvailable', unavailable:'unavailable', revoked:'revoked', restarting:'restarting', error:'outputError'};
  let locale = 'ru', running = false, busy = false, ready = false, savedEncryption = false, paths = {}, statuses = {}, assignments = {}, errorKey = '';
  const t = key => copy[locale][key] || key;
  const bytes = value => new TextEncoder().encode(value).length;
  const controlCharacters = /[\u0000-\u001f\u007f]/u;
  let theme = 'dark';
  try { const stored = localStorage.getItem('castlink-launcher-theme'); theme = ['dark','light'].includes(stored) ? stored : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch {}
  document.documentElement.dataset.theme = theme;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function field(label, type) {
    const wrapper = element('label');
    const caption = element('span', '', label);
    const input = element('input'); input.type = type;
    wrapper.append(caption, input);
    return {wrapper, caption, input};
  }
  function createRow(slot, index, saved, selected) {
    const node = element('li', 'slot-row'); node.dataset.slotId = slot.id;
    const identity = element('div', 'slot-identity');
    const enabled = element('input'); enabled.type = 'checkbox'; enabled.checked = selected;
    const slotCopy = element('div', 'slot-copy');
    const name = element('span', 'slot-name');
    const assignment = element('span', 'assignment');
    const status = element('span', 'status'); status.title = t('sourceNote');
    slotCopy.append(name, assignment, status); identity.append(enabled, slotCopy);
    const sourceLabel = element('label', 'source-field');
    const sourceCaption = element('span', 'mobile-label', t('source'));
    const source = element('select');
    for (const value of ['camera','screen']) { const option = element('option'); option.value = value; source.append(option); }
    source.value = saved?.source === 'screen' ? 'screen' : 'camera';
    sourceLabel.append(sourceCaption, source);
    const receiver = element('div', 'receiver-field');
    const outputName = element('span', 'receiver-name');
    const meta = element('span', 'receiver-meta');
    const endpoints = element('div', 'endpoint-fields');
    const port = field(t('port'), 'number'); port.wrapper.className = 'port-field'; port.input.min = '1'; port.input.max = '65535'; port.input.step = '1'; port.input.value = saved?.port ?? 9001 + index;
    const stream = field(t('streamId'), 'text'); stream.wrapper.className = 'stream-field'; stream.input.value = saved?.streamId || ''; stream.input.autocomplete = 'off'; stream.input.spellcheck = false;
    endpoints.append(port.wrapper, stream.wrapper); receiver.append(outputName, meta, endpoints);
    node.append(identity, sourceLabel, receiver);
    const row = {node, slot, enabled, name, assignment, status, source, sourceCaption, outputName, meta, endpoints, port, stream};
    enabled.addEventListener('change', () => { if ([...rows.values()].filter(row => row.enabled.checked).length > 4) { enabled.checked = false; showError('slotsError'); } else showError(''); render(); });
    for (const input of [source, port.input, stream.input]) input.addEventListener('input', render);
    return row;
  }
  function syncSlots(slots, config, selectDefaults) {
    const currentIds = new Set();
    const saved = Array.isArray(config?.slots) ? config.slots.filter(candidate => slots.some(slot => slot?.id === candidate?.id)) : [];
    const assigned = slots.filter(slot => slot && (Object.hasOwn(assignments, slot.id) ? assignments[slot.id] : slot.assignment)).slice(0, 4);
    const defaults = [...new Set([...assigned, ...slots.filter(slot => slot && typeof slot.id === 'string')])];
    const defaultIds = new Set(defaults.slice(0, Math.max(3, assigned.length)).map(slot => slot.id));
    slots.forEach((slot, index) => {
      if (!slot || typeof slot.id !== 'string' || currentIds.has(slot.id)) return;
      currentIds.add(slot.id);
      const previous = saved?.find(candidate => candidate.id === slot.id);
      let row = rows.get(slot.id);
      if (!row) { const selected = selectDefaults && (saved.length ? Boolean(previous) : defaultIds.has(slot.id)) && [...rows.values()].filter(row => row.enabled.checked).length < 4; row = createRow(slot, index, previous, selected); rows.set(slot.id, row); $('slots').append(row.node); }
      row.slot = slot;
    });
    for (const [id, row] of rows) if (!currentIds.has(id)) { row.node.remove(); rows.delete(id); }
  }
  function showError(key) { errorKey = key; $('error').textContent = key ? t(key) : ''; $('error').hidden = !key; }
  function render() {
    const mode = $('protocol').value, isSrt = mode === 'srt', locked = running || busy || !ready;
    document.documentElement.lang = locale;
    $('locale').value = locale;
    document.querySelectorAll('[data-copy]').forEach(node => { node.textContent = t(node.dataset.copy); });
    $('toggle').textContent = busy ? t('busy') : t(running ? 'stop' : 'start');
    $('toggle').dataset.running = String(running);
    $('toggle').disabled = busy || !ready || (!running && !rows.size);
    $('protocol').disabled = locked;
    $('configuration').disabled = locked;
    $('srt-settings').hidden = !isSrt;
    const rendezvous = isSrt && $('srt-mode').value === 'rendezvous';
    $('local-address-field').hidden = $('relay-settings').hidden = !rendezvous;
    $('relay-path').textContent = paths.relay || t('missing');
    $('address-label').textContent = t($('srt-mode').value === 'listener' ? 'localAddress' : 'remoteAddress');
    $('key-length').disabled = !$('passphrase').value;
    $('receiver-help').textContent = t(mode + 'Help').replace('{role}', roles[$('srt-mode').value]);
    $('runtime-label').textContent = t(mode + 'Runtime');
    $('runtime-path').textContent = paths[mode] || t(mode === 'ndi' ? 'auto' : 'missing');
    $('runtime-help').textContent = t(mode + 'RuntimeHelp');
    $('bitrate').disabled = mode !== 'srt';
    const selected = [...rows.values()].filter(row => row.enabled.checked).length;
    $('count').textContent = ready ? t('selected').replace('{n}', selected) : '';
    $('notice').textContent = t(!ready ? 'loading' : rows.size ? 'selection' : 'empty');
    $('slots').setAttribute('aria-label', t('outputs'));
    for (const row of rows.values()) {
      const name = typeof row.slot.name === 'string' ? row.slot.name : row.slot.id;
      const active = row.enabled.checked;
      row.name.textContent = name;
      const assignment = Object.hasOwn(assignments, row.slot.id) ? assignments[row.slot.id] : row.slot.assignment;
      row.assignment.textContent = typeof assignment === 'string' && assignment ? assignment : t('unassigned');
      row.enabled.disabled = locked;
      row.enabled.setAttribute('aria-label', t('include') + ': ' + name);
      row.source.disabled = locked || !active;
      row.source.setAttribute('aria-label', t('source') + ': ' + name);
      row.sourceCaption.textContent = t('source');
      for (const option of row.source.options) option.textContent = t(option.value);
      const raw = statuses[row.slot.id];
      const state = typeof raw === 'string' ? raw : raw?.state;
      row.status.dataset.state = active && state === 'error' ? 'error' : active && running ? state || 'waiting' : 'stopped';
      row.status.textContent = t(!active ? 'notSelected' : state === 'error' ? 'outputError' : !running ? 'stopped' : stateKeys[state] || 'waiting');
      row.status.title = t('sourceNote');
      row.outputName.textContent = isSrt ? 'CastLink — ' + name : row.slot.nativeName || 'CastLink-' + row.slot.id;
      let host = (rendezvous ? $('local-address') : $('address')).value.trim();
      if (['', '0.0.0.0', '::'].includes(host)) host = t('castlinkIp');
      else if (host.includes(':') && !host.startsWith('[')) host = '[' + host + ']';
      const role = roles[$('srt-mode').value];
      const endpoint = role === 'Listener' ? t('port') + ' ' + row.port.input.value : host + ':' + row.port.input.value;
      const encrypted = $('passphrase').value || running && savedEncryption;
      row.meta.textContent = isSrt ? endpoint + ' · SRT ' + role + ' · ' + $('latency').value + ' ' + t('milliseconds') + (encrypted ? ' · ' + t('encrypted') : '') : mode.toUpperCase() + ' · ' + t(row.source.value);
      row.endpoints.hidden = !isSrt;
      row.stream.wrapper.hidden = !$('advanced').open;
      row.port.caption.textContent = t('port'); row.stream.caption.textContent = t('streamId');
      row.port.input.setAttribute('aria-label', t('port') + ': ' + name);
      row.stream.input.setAttribute('aria-label', t('streamId') + ': ' + name);
      row.port.input.disabled = row.stream.input.disabled = locked || !active;
    }
    showError(errorKey);
  }
  function configFromForm() {
    return {mode:$('protocol').value, fps:Number($('fps').value), bitrateKbps:Number($('bitrate').value), srt:{mode:$('srt-mode').value, address:$('address').value.trim(), localAddress:$('local-address').value.trim(), latencyMs:Number($('latency').value), passphrase:$('passphrase').value, keyLength:Number($('key-length').value)}, slots:[...rows.values()].filter(row => row.enabled.checked).map(row => ({id:row.slot.id, source:row.source.value, port:Number(row.port.input.value), streamId:row.stream.input.value}))};
  }
  function validation(config) {
    if (!config.slots.length || config.slots.length > 4) return 'slotsError';
    if (config.mode !== 'ndi' && !paths[config.mode]) return 'pathError';
    if (![30,50,60].includes(config.fps) || !Number.isInteger(config.bitrateKbps) || config.bitrateKbps < 500 || config.bitrateKbps > 25000) return 'qualityError';
    if (config.mode !== 'srt') return '';
    const srt = config.srt;
    if (srt.mode === 'rendezvous' && !paths.relay) return 'pathError';
    if (!srt.address || /[\s/?#@%\\]/u.test(srt.address) || srt.address.includes('://') || controlCharacters.test(srt.address)) return 'addressError';
    if ($('latency').value === '' || !Number.isInteger(srt.latencyMs) || srt.latencyMs < 0 || srt.latencyMs > 60000) return 'latencyError';
    if (srt.passphrase && (bytes(srt.passphrase) < 10 || bytes(srt.passphrase) > 79 || controlCharacters.test(srt.passphrase))) return 'passphraseError';
    if (new Set(config.slots.map(slot => slot.port)).size !== config.slots.length || config.slots.some(slot => !Number.isInteger(slot.port) || slot.port < 1 || slot.port > 65535)) return 'portError';
    if (config.slots.some(slot => bytes(slot.streamId) > 512 || controlCharacters.test(slot.streamId))) return 'streamError';
    return '';
  }
  function applyConfig(config) {
    if (!config) return;
    if (['srt','ndi','omt'].includes(config.mode)) $('protocol').value = config.mode;
    const srt = config.srt || {};
    if (['caller','listener','rendezvous'].includes(srt.mode)) $('srt-mode').value = srt.mode;
    for (const [id, key] of [['address','address'],['local-address','localAddress'],['latency','latencyMs'],['passphrase','passphrase'],['key-length','keyLength']]) if (srt[key] !== undefined) $(id).value = srt[key];
    if ([30,50,60].includes(config.fps)) $('fps').value = config.fps;
    if (config.bitrateKbps !== undefined) $('bitrate').value = config.bitrateKbps;
  }
  function snapshot(value, initial = false) {
    if (!value || typeof value !== 'object') return;
    if (initial) { locale = value.locale in copy ? value.locale : 'ru'; savedEncryption = Boolean(value.config?.srt?.encrypted); applyConfig(value.config); }
    if (value.assignments) assignments = {...assignments, ...value.assignments};
    if (Array.isArray(value.slots)) syncSlots(value.slots, initial ? value.config : null, initial);
    if (value.paths) paths = {...paths, ...value.paths};
    if (typeof value.running === 'boolean') running = value.running;
    if (value.statuses) statuses = value.statuses;
    render();
  }
  $('locale').addEventListener('change', () => { locale = $('locale').value; render(); });
  $('theme').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('castlink-launcher-theme', theme); } catch {} });
  for (const id of ['protocol','srt-mode','address','local-address','latency','passphrase','key-length','fps','bitrate']) $(id).addEventListener('input', () => { showError(''); render(); });
  $('advanced').addEventListener('toggle', render);
  async function pick(mode) {
    if (!ready || running || busy) return;
    busy = true; showError(''); render();
    try { const path = await api.pick(mode); if (typeof path === 'string' && path) paths[mode] = path; }
    catch { showError('pickError'); }
    finally { busy = false; render(); }
  }
  $('pick-runtime').addEventListener('click', () => pick($('protocol').value));
  $('pick-relay').addEventListener('click', () => pick('relay'));
  $('outputs').addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy) return;
    const wasRunning = running, config = configFromForm();
    const issue = wasRunning ? '' : validation(config);
    if (issue) { showError(issue); if (issue === 'pathError') $('pick-runtime').closest('details').open = true; return; }
    busy = true; showError(''); render();
    try {
      if (wasRunning) { await api.stop(); running = false; statuses = {}; }
      else { const result = await api.start(config); if (!result?.ok) { showError('startError'); } else { running = true; savedEncryption = Boolean(config.srt.passphrase); } }
    } catch { showError(wasRunning ? 'stopError' : 'startError'); }
    finally { busy = false; render(); }
  });
  render();
  (async () => {
    try {
      if (!api) throw new Error('NO_BRIDGE');
      const initial = await api.initial(); ready = true; snapshot(initial, true);
      const unsubscribe = api.onStatus(value => snapshot(value));
      window.addEventListener('beforeunload', () => { if (typeof unsubscribe === 'function') unsubscribe(); }, {once:true});
    } catch { ready = false; showError('initError'); render(); }
  })();
})();
