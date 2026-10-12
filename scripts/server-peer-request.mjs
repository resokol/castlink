import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';
import { exactHttpsOrigin, validateProvisioningHost } from './server-profile-store.mjs';
/** Connect only to the SSH-proven address and keep certificate/hostname checks. */
export async function requestServerPeer(peer, pathname, options = {}) {
    const timeoutMs = options.timeoutMs || 7000, deadlineAt = Date.now() + timeoutMs;
    const origin = exactHttpsOrigin(peer.origin), url = new URL(pathname, origin);
    if (url.origin !== origin || url.username || url.password || url.hash || !pathname.startsWith('/api/'))
        throw Error('Invalid peer request path');
    let address = peer.connectAddress;
    if (!address) {
        if (isIP(url.hostname) === 4)
            address = validateProvisioningHost(url.hostname);
        else {
            let lookupTimer;
            let answers;
            try { answers = await Promise.race([lookup(url.hostname, { all: true, verbatim: true }), new Promise((_, reject) => { lookupTimer = setTimeout(() => reject(Error('Peer HTTPS verification or connection failed', { cause: Object.assign(Error('Peer timeout'), { code: 'ETIMEDOUT' }) })), Math.max(1, deadlineAt - Date.now())); })]); }
            finally { clearTimeout(lookupTimer); }
            if (!answers.length || answers.some(answer => answer.family !== 4))
                throw Error('Peer requires a public IPv4');
            for (const answer of answers)
                validateProvisioningHost(answer.address);
            address = answers[0].address;
        }
    }
    // Pinned private IPs are accepted only from root-installed peer records; web
    // provisioning validates public-IP/operator policy before writing a record.
    if (isIP(address) !== 4)
        throw Error('Invalid pinned server address');
    return new Promise((resolve, reject) => {
        let deadline;
        const finish = callback => value => { clearTimeout(deadline); callback(value); };
        const complete = finish(resolve), fail = finish(reject);
        const req = request({ hostname: address, port: url.port || 443, path: url.pathname + url.search, method: options.method || 'GET', headers: { ...options.headers, host: url.host }, ca: peer.ca, servername: isIP(url.hostname) ? undefined : url.hostname,
            checkServerIdentity: (_hostname, certificate) => checkServerIdentity(url.hostname, certificate), timeout: options.timeoutMs || 7000 }, res => {
            let bytes = 0;
            const chunks = [];
            res.on('data', (chunk) => { bytes += chunk.length; if (bytes > 1024 * 1024) {
                req.destroy(Error('Peer response is too large'));
                return;
            } chunks.push(chunk); });
            res.on('error', error => fail(Error('Peer connection failed', { cause: error })));
            res.on('end', () => {
              try {
                if ((res.statusCode || 500) >= 300 && (res.statusCode || 500) < 400) {
                    fail(Error('Peer redirects are refused'));
                    return;
                }
                const headers = new Headers();
                for (const [name, value] of Object.entries(res.headers))
                    if (value !== undefined)
                        headers.set(name, Array.isArray(value) ? value.join(', ') : value);
                const status=res.statusCode||500;
                complete(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks), { status, headers }));
              }catch{fail(Error('Invalid peer HTTP response'));}
            });
        });
        deadline = setTimeout(() => req.destroy(Object.assign(Error('Peer timeout'), { code: 'ETIMEDOUT' })), Math.max(1, deadlineAt - Date.now()));
        req.on('error', error => fail(Error('Peer HTTPS verification or connection failed', { cause: error })));
        req.on('timeout', () => req.destroy(Object.assign(Error('Peer timeout'), { code: 'ETIMEDOUT' })));
        req.end(options.body);
    });
}
