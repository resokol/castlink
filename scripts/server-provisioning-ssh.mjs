import { createHash } from 'node:crypto';
export function makeSshTools(Client){
const fingerprintOf = (key) => 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
/** Capture the key and abort before any authentication credential is sent. */
function probeSshFingerprint(endpoint) {
    return new Promise((resolve, reject) => {
        const client = new Client();
        let observed = '';
        const timer = setTimeout(() => { client.destroy(); reject(Error('SSH connection deadline exceeded')); }, 15000);
        client.on('error', () => { clearTimeout(timer); client.destroy(); observed ? resolve(observed) : reject(Error('SSH server is unavailable')); });
        client.on('close', () => { clearTimeout(timer); observed ? resolve(observed) : reject(Error('SSH server is unavailable')); });
        client.connect({ ...endpoint, username: 'root', readyTimeout: 12000, authHandler: () => false, hostVerifier: (key) => { observed = fingerprintOf(key); return false; } });
    });
}
async function openVerifiedSsh(endpoint) {
    if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(endpoint.fingerprint) || typeof endpoint.password !== 'string' || !endpoint.password || endpoint.password.length > 1024)
        throw Error('Invalid SSH credentials or host key');
    const client = await new Promise((resolve, reject) => {
        const connection = new Client();
        let settled = false;
        const timer = setTimeout(() => { connection.destroy(); reject(Error('SSH connection deadline exceeded')); }, 20000);
        connection.on('error', (error) => { if (!settled) {
            settled = true;
            clearTimeout(timer);
            connection.destroy();
            const failure=Error(error?.level==='client-authentication'?'SSH authentication failed':'SSH login or host key verification failed');
            if(error?.level==='client-authentication')failure.code='ssh-authentication-failed';
            reject(failure);
        } });
        connection.on('ready', () => { settled = true; clearTimeout(timer); resolve(connection); });
        connection.connect({ host: endpoint.host, port: endpoint.port, username: 'root', password: endpoint.password, readyTimeout: 15000, keepaliveInterval: 15000, keepaliveCountMax: 3, hostVerifier: (key) => fingerprintOf(key) === endpoint.fingerprint });
    });
    try {
        if ((await executeFixedSsh(client, 'id -u', '', 10000)).trim() !== '0')
            throw Error('Root SSH login is required');
        return client;
    }
    catch (error) {
        client.end();
        throw error;
    }
}
/** Callers select fixed commands; input, including pairing secrets, uses stdin. */
function executeFixedSsh(client, command, input, timeoutMs = 1800000, onLine) {
    return new Promise((resolve, reject) => {
        let bytes = 0;
        let output = '';
        let partial = '';
        let finished = false;
        const timer = setTimeout(() => { client.end(); reject(Error('VPS operation deadline exceeded')); }, timeoutMs);
        const fail = () => { if (!finished) {
            finished = true;
            clearTimeout(timer);
            reject(Error('VPS operation refused'));
        } };
        client.exec(command, (error, stream) => {
            if (error) {
                fail();
                return;
            }
            stream.on('error', fail);
            stream.on('data', (data) => {
                bytes += data.length;
                if (bytes > 2 * 1024 * 1024) {
                    stream.close();
                    fail();
                    return;
                }
                const text = data.toString('utf8');
                output += text;
                if (onLine) {
                    partial += text;
                    const lines = partial.split('\n');
                    partial = lines.pop() || '';
                    for (const line of lines)
                        onLine(line);
                }
            });
            // Remote stderr can contain private process data; never reflect or log it.
            stream.stderr.on('data', () => { });
            stream.on('close', (code) => { if (finished)
                return; finished = true; clearTimeout(timer); code === 0 ? resolve(output) : reject(Error('VPS operation refused')); });
            stream.end(input);
        });
    });
}

return {probeSshFingerprint,openVerifiedSsh,executeFixedSsh};
}
