import { createHash,randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { serverProfileIdentity, putServerPeer, validateProvisioningHost, exactHttpsOrigin, requireUuid } from './server-profile-store.mjs';
export function makeProvisioning({openVerifiedSsh,executeFixedSsh,requestServerPeer}){
const jobKey=Symbol.for('castlink.server-provisioning-jobs');
const jobs = globalThis[jobKey]||(globalThis[jobKey]=new Map());
const stageLabels = { release: 'Проверка текущего выпуска CastLink', connecting: 'Подключение по SSH', runtime: 'Проверка Ubuntu и Docker', download: 'Загрузка проверенного выпуска', images: 'Загрузка серверных компонентов', start: 'Запуск CastLink', database: 'Подготовка базы данных', ready: 'Проверка HTTPS', pairing: 'Подключение серверов', complete: 'Сервер подключён' };
const finiteStages = new Set(Object.keys(stageLabels));
function validateProvisioningInput(input) {
    validateProvisioningHost(input.host);
    if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535 || !['connect', 'deploy'].includes(input.mode) || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 100 || /[\x00-\x1f]/.test(input.label) || !/^SHA256:[A-Za-z0-9+/]{43}$/.test(input.fingerprint) || typeof input.password !== 'string' || !input.password || input.password.length > 1024)
        throw Error('Некорректные данные подключения');
    if (input.installationId)
        requireUuid(input.installationId);
}
function getServerProvisioningJob(id, roomId) { const saved = jobs.get(id); return saved?.roomId === roomId ? { ...saved.job, stage: stageLabels[saved.job.stage] || saved.job.stage } : null; }
function startServerProvisioning(input, authorization) {
    validateProvisioningInput(input);
    requireUuid(authorization.roomId);
    const now = Date.now();
    for (const [id, saved] of jobs)
        if (saved.job.state !== 'running' && saved.job.createdAt < now - 3600000)
            jobs.delete(id);
    if ([...jobs.values()].some(saved => saved.roomId === authorization.roomId && saved.job.state === 'running'))
        throw Error('Подключение сервера для этой комнаты уже выполняется');
    if ([...jobs.values()].filter(saved => saved.job.state === 'running').length >= 8)
        throw Error('Сервер занят подключениями; попробуй позже');
    const job = { id: randomUUID(), state: 'running', stage: input.mode === 'deploy' ? 'release' : 'connecting', createdAt: now };
    jobs.set(job.id, { roomId: authorization.roomId, job });
    void provisionServer(input, { scope: { kind: 'room', roomId: authorization.roomId }, assertAuthorized: authorization.assertAuthorized, onProgress: value => {
            if (value.stage && finiteStages.has(value.stage))
                job.stage = value.stage;
            for (const key of ['bytes', 'total', 'bytesPerSecond'])
                if (typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0)
                    job[key] = value[key];
        } }).then(peer => { job.state = 'complete'; job.stage = 'complete'; job.peerId = peer.id; }, error => { job.state = 'failed'; job.error = error?.code === 'ssh-authentication-failed' ? 'SSH пароль не принят сервером. Проверь root-доступ и пароль.' : error instanceof ProvisioningError ? error.message : 'Не удалось подключить сервер. Проверь SSH, память VPS, свободные порты и HTTPS. Данные VPS сохранены.'; });
    return { ...job, stage: stageLabels[job.stage] || job.stage };
}
class ProvisioningError extends Error {
}
async function runtimeScript(name) {
    for (const folder of [path.resolve(process.cwd(), 'scripts'), path.resolve(process.cwd(), '../../scripts'), '/app/scripts'])
        try {
            return await readFile(path.join(folder, name), 'utf8');
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    throw new ProvisioningError('Выпуск сервера не поддерживает подключение резервов. Обнови CastLink.');
}
async function remoteOperation(client, data, onProgress) {
    const source = await runtimeScript('server-provision-vps.py');
    const program = `import base64,json\npayload=json.loads(base64.b64decode('${Buffer.from(JSON.stringify(data)).toString('base64')}'))\n__name__='castlink_provision'\nexec(compile(base64.b64decode('${Buffer.from(source).toString('base64')}'),'castlink-provision','exec'))\ntry:\n event(result=main(payload))\nexcept ValueError as error:\n message=str(error)\n safe=('Required VPS port is occupied; existing services were preserved','CastLink startup deadline exceeded')\n prefixes=('Incomplete installation','Existing Easy Setup scope','Multiple incomplete Easy Setup scopes')\n event(error=message if message in safe or message.startswith(prefixes) else 'VPS operation refused')\n raise SystemExit(1)\nexcept Exception:\n event(error='VPS operation refused');raise SystemExit(1)\n`;
    let remoteError;
    let output;
    try { output = await executeFixedSsh(client, 'python3 -', program, 1800000, line => { try {
        const value = JSON.parse(line);
        if (value.stage)
            onProgress?.(value);
        if (typeof value.error === 'string') remoteError = value.error;
    }
    catch { } }); }
    catch (error) {
        if (remoteError === 'Required VPS port is occupied; existing services were preserved') throw new ProvisioningError('Нужный порт VPS занят другой службой. Существующие сервисы сохранены.');
        if (/^(Incomplete installation|Existing Easy Setup scope|Multiple incomplete Easy Setup scopes)/.test(remoteError || '')) throw new ProvisioningError('Незавершённая установка на VPS требует проверки: её выпуск или сохранённые файлы не совпадают. Данные сохранены.');
        if (remoteError === 'CastLink startup deadline exceeded') throw new ProvisioningError('CastLink не запустился на VPS за 3 минуты. Проверь память и состояние контейнеров; данные установки сохранены.');
        throw error;
    }
    const lines = output.trim().split('\n');
    const response = JSON.parse(lines[lines.length - 1]);
    if (!response.result)
        throw Error('Invalid VPS operation result');
    return response.result;
}
async function knownReleaseText(url, limit = 65536) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const target = new URL(url);
        if (target.protocol !== 'https:' || target.username || target.password || !['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(target.hostname))
            throw Error('Unexpected release origin');
        const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'CastLink-Easy-Setup' } });
        if (response.status >= 300 && response.status < 400) {
            url = new URL(response.headers.get('location') || '', url).href;
            continue;
        }
        if (!response.ok)
            throw Error('Public release is unavailable');
        if (Number(response.headers.get('content-length') || 0) > limit)
            throw Error('Release metadata is too large');
        const reader = response.body?.getReader();
        if (!reader)
            throw Error('Release metadata is empty');
        let output = '';
        let bytes = 0;
        while (true) {
            const next = await reader.read();
            if (next.done)
                break;
            bytes += next.value.length;
            if (bytes > limit) {
                await reader.cancel();
                throw Error('Release metadata is too large');
            }
            output += Buffer.from(next.value).toString('utf8');
        }
        return output;
    }
    throw Error('Too many release redirects');
}
async function currentProvisioningRelease() {
    const value = JSON.parse(await knownReleaseText('https://api.github.com/repos/resokol/castlink-releases/releases/latest'));
    if (!/^easy-setup-[a-f0-9]{12}$/.test(value.tag_name) || value.draft || value.prerelease)
        throw Error('Invalid public release tag');
    const base = 'https://github.com/resokol/castlink-releases/releases/download/' + value.tag_name + '/';
    const sums = await knownReleaseText(base + 'SHA256SUMS');
    const matches = sums.split(/\r?\n/).filter((line) => /^[a-f0-9]{64}  CastLink-Linux\.tar\.gz$/.test(line));
    if (matches.length !== 1)
        throw Error('Public Linux checksum is absent');
    try{
      const entries=sums.split(/\r?\n/).filter(line=>/^[a-f0-9]{64}  CastLink-Provisioning\.json$/.test(line));
      if(entries.length!==1)throw Error('Capability checksum absent');
      const text=await knownReleaseText(base+'CastLink-Provisioning.json');
      if(createHash('sha256').update(text).digest('hex')!==entries[0].slice(0,64))throw Error('Capability checksum mismatch');
      const metadata=JSON.parse(text);
      if(metadata.schemaVersion!==1||!/^([a-f0-9]{40})$/.test(metadata.commit)||!metadata.commit.startsWith(value.tag_name.slice(11))||!Array.isArray(metadata.capabilities)||!['peer-profile-v1','root-ssh-v1'].every(item=>metadata.capabilities.includes(item)))throw Error('Incompatible release capabilities');
      return { releaseUrl: base + 'CastLink-Linux.tar.gz', releaseSha256: matches[0].slice(0, 64), releaseCommitPrefix: value.tag_name.slice(11),releaseCommit:metadata.commit };
    }catch{throw new ProvisioningError('Текущий публичный выпуск ещё не поддерживает резервы. Дождись публикации совместимого выпуска и обнови CastLink; VPS не изменён.');}
}
function verifiedRemoteIdentity(value) {
    requireUuid(value?.installationId);
    exactHttpsOrigin(value?.origin);
    if (typeof value.id !== 'string' || !/^srv-[a-f0-9]{32}$/.test(value.id) || value.id !== 'srv-' + value.installationId.replaceAll('-', ''))
        throw Error('Invalid VPS installation identity');
    if (value.ca !== undefined && (typeof value.ca !== 'string' || value.ca.length > 32768))
        throw Error('Invalid peer certificate');
    return value;
}
async function provisionServer(input, options) {
    validateProvisioningInput(input);
    await options.assertAuthorized();
    let client;
    try {
        const local = await serverProfileIdentity();
        // Capability metadata is checked before opening SSH or preparing Docker.
        if(input.mode==='deploy')options.onProgress?.({ stage: 'release' });
        const release=input.mode==='deploy'?await currentProvisioningRelease():undefined;
        options.onProgress?.({ stage: 'connecting' });
        client = await openVerifiedSsh(input);
        input.password = '';
        options.onProgress?.({ stage: 'runtime' });
        const bootstrap = await runtimeScript('ubuntu-easy-setup-bootstrap.sh');
        const definitions = bootstrap.slice(0, bootstrap.lastIndexOf('if [[ ${BASH_SOURCE'));
        await executeFixedSsh(client, 'bash -s', definitions + '\ncheck_platform\n' + (input.mode === 'deploy' ? 'if ! runtime_ready; then install_runtime; fi\n' : '') + 'runtime_ready\n', 1200000);
        let remote;
        let commitPrefix;
        if (input.mode === 'deploy') {
            commitPrefix = release.releaseCommitPrefix;
            await options.assertAuthorized();
            remote = verifiedRemoteIdentity(await remoteOperation(client, { action: 'deploy', host: input.host, ...release }, options.onProgress));
        }
        else {
            const inspected = await remoteOperation(client, { action: 'inspect' });
            const candidates = Array.isArray(inspected.installations) ? inspected.installations : [];
            if (!candidates.length)
                throw new ProvisioningError('Не найден работающий совместимый CastLink Easy Setup. Обнови установленный сервер или выбери установку на пустой VPS.');
            const selected = input.installationId ? candidates.find((v) => v.installationId === input.installationId) : candidates.length === 1 ? candidates[0] : null;
            if (!selected)
                throw new ProvisioningError('На VPS несколько установок. Укажи UUID нужной установки из её мастера.');
            remote = verifiedRemoteIdentity(selected);
        }
        if (remote.installationId === local.installationId)
            throw new ProvisioningError('Это текущий сервер. Для резерва нужен другой VPS.');
        const peer = { id: randomUUID(), label: input.label.trim(), installationId: remote.installationId, origin: remote.origin, secret: randomBytes(32).toString('hex'), scope: options.scope, connectAddress: input.host, ...(remote.ca ? { ca: remote.ca } : {}) };
        options.onProgress?.({ stage: 'ready' });
        const deadline = Date.now() + (input.mode === 'deploy' ? 180000 : 15000);
        let verified = false;
        while (!verified) {
            try {
                const response = await requestServerPeer(peer, '/api/version', { timeoutMs: 10000 });
                const version = await response.json();
                if (!response.ok || typeof version.buildId !== 'string' || commitPrefix && !version.buildId.endsWith('-' + commitPrefix))
                    throw Error('Version mismatch');
                verified = true;
            }
            catch (error) {
                if (Date.now() >= deadline)
                    throw new ProvisioningError('HTTPS целевого сервера не готов или сертификат не совпадает. Проверь DNS и TCP 80/443. Данные VPS сохранены.');
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        await options.assertAuthorized();
        options.onProgress?.({ stage: 'pairing' });
        const incoming = { id: peer.id, label: local.label, installationId: local.installationId, origin: local.origin, secret: peer.secret, scope: options.scope, ...(local.ca ? { ca: local.ca } : {}) };
        const result = await remoteOperation(client, { action: 'register', installationId: remote.installationId, peer: incoming });
        if (result.installationId !== remote.installationId || result.origin !== remote.origin || result.ok !== true)
            throw Error('VPS pairing identity changed');
        await options.assertAuthorized();
        await (options.persistPeer||putServerPeer)(peer);
        return peer;
    }
    finally {
        input.password = '';
        client?.end();
    }
}

return {validateProvisioningInput,getServerProvisioningJob,startServerProvisioning,currentProvisioningRelease,provisionServer};
}
