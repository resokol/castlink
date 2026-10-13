import { createHash,generateKeyPair } from 'node:crypto';
export const SSH_PRIVATE_KEY_MAX_BYTES = 65536;
/** Select one authentication method; never fall back to another credential. */
export function validateSshAuthentication(input) {
    const authType = input.authType ?? 'password';
    if (authType === 'password') {
        if (typeof input.password !== 'string' || !input.password || input.password.length > 1024)
            throw Error('Некорректные данные подключения');
    } else if (authType === 'private-key') {
        if (typeof input.privateKey !== 'string' || !input.privateKey || Buffer.byteLength(input.privateKey, 'utf8') > SSH_PRIVATE_KEY_MAX_BYTES ||
            (input.passphrase !== undefined && (typeof input.passphrase !== 'string' || input.passphrase.length > 1024))) {
            const error = Error('Некорректный SSH приватный ключ или его пароль. Используй файл OpenSSH или PEM до 64 КиБ.');
            error.code = 'ssh-private-key-invalid';
            throw error;
        }
    } else throw Error('Некорректный способ SSH входа');
    return authType;
}
export function clearSshCredentials(input) {
    input.password = ''; input.privateKey = ''; input.passphrase = '';
}
export function makeSshTools(Client, parseKey){
const fingerprintOf = (key) => 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
function parsedPrivateKey(privateKey, passphrase) {
    validateSshAuthentication({authType:'private-key',privateKey,passphrase});
    let parsed;
    try {
        if (!/^-----BEGIN (?:OPENSSH |RSA |EC |DSA )PRIVATE KEY-----\r?\n/.test(privateKey.trim())) throw Error('Unsupported format');
        if (privateKey.trim().startsWith('-----BEGIN OPENSSH')) {
            // OpenSSH embeds a synchronous bcrypt work factor. Bound it before parsing.
            const data=Buffer.from(privateKey.trim().split(/\r?\n/).slice(1,-1).join(''),'base64');
            let offset=15;
            const readString=()=>{if(offset+4>data.length)throw Error('Invalid key');const length=data.readUInt32BE(offset);offset+=4;if(length>data.length-offset)throw Error('Invalid key');const value=data.subarray(offset,offset+length);offset+=length;return value;};
            readString();const kdf=readString().toString('ascii'),options=readString();
            if(kdf==='bcrypt'){
                if(options.length<8)throw Error('Invalid key');const saltLength=options.readUInt32BE(0);
                if(saltLength>options.length-8||options.readUInt32BE(4+saltLength)>256)throw Error('Invalid key');
            }
        }
        parsed = parseKey?.(privateKey, passphrase);
    } catch { }
    if (Array.isArray(parsed) && parsed.length === 1) parsed = parsed[0];
    if (!parsed || parsed instanceof Error || Array.isArray(parsed) || typeof parsed.isPrivateKey !== 'function' || !parsed.isPrivateKey()) {
        const error = Error('Некорректный SSH приватный ключ или его пароль. Используй файл OpenSSH или PEM до 64 КиБ.');
        error.code = 'ssh-private-key-invalid';
        throw error;
    }
    return parsed;
}
function validateSshKeyPair(publicKey, privateKey) {
    const parsed = parsedPrivateKey(privateKey);
    if (typeof publicKey !== 'string' || publicKey.length > 8192 || !/^ssh-rsa [A-Za-z0-9+/]+={0,2}$/.test(publicKey) ||
        publicKey !== 'ssh-rsa ' + parsed.getPublicSSH().toString('base64'))
        throw Error('Некорректная пара SSH ключей');
}
async function generateSshKeyPair() {
    const privateKey = await new Promise((resolve,reject)=>generateKeyPair('rsa', {modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs1',format:'pem'}}, (error,_public,secret)=>error?reject(Error('Не удалось создать SSH ключ')):resolve(secret)));
    const parsed = parsedPrivateKey(privateKey);
    return {privateKey,publicKey:'ssh-rsa '+parsed.getPublicSSH().toString('base64')};
}
/** Capture the key and abort before any authentication credential is sent. */
function probeSshFingerprint(endpoint) {
    return new Promise((resolve, reject) => {
        const client = new Client();
        let observed = '';
        const timer = setTimeout(() => { client.destroy(); reject(Error('SSH connection deadline exceeded')); }, 15000);
        client.on('error', () => { clearTimeout(timer); client.destroy(); observed ? resolve(observed) : reject(Error('SSH server is unavailable')); });
        client.on('close', () => { clearTimeout(timer); observed ? resolve(observed) : reject(Error('SSH server is unavailable')); });
        client.connect({ host:endpoint.host, port:endpoint.port, username: 'root', readyTimeout: 12000, authHandler: () => false, hostVerifier: (key) => { observed = fingerprintOf(key); return false; } });
    });
}
async function openVerifiedSsh(endpoint) {
    if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(endpoint.fingerprint))
        throw Error('Invalid SSH credentials or host key');
    const authType = validateSshAuthentication(endpoint);
    let authentication;
    if (authType === 'private-key') {
        // ssh2's parser supports OpenSSH/PEM; its raw errors may contain input.
        parsedPrivateKey(endpoint.privateKey, endpoint.passphrase);
        authentication = { privateKey: endpoint.privateKey, ...(endpoint.passphrase ? { passphrase: endpoint.passphrase } : {}) };
    } else authentication = { password: endpoint.password };
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
        try {
            connection.connect({ host: endpoint.host, port: endpoint.port, username: 'root', ...authentication, readyTimeout: 15000, keepaliveInterval: 15000, keepaliveCountMax: 3, hostVerifier: (key) => fingerprintOf(key) === endpoint.fingerprint });
        } catch {
            settled = true; clearTimeout(timer); connection.destroy();
            reject(Error('SSH login or host key verification failed'));
        }
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

return {probeSshFingerprint,openVerifiedSsh,executeFixedSsh,generateSshKeyPair,validateSshKeyPair};
}
