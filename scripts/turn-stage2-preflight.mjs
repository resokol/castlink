import dns from "node:dns/promises";
import tls from "node:tls";
import https from "node:https";

const args = process.argv.slice(2);
const valueOf = (flag, fallback) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] || "" : fallback; };
if (args.includes("--help")) {
  console.log("Usage: node scripts/turn-stage2-preflight.mjs [--host relay.example.com] [--site site.example.com] [--expected-ip x.x.x.x]");
  process.exit(0);
}
const host = valueOf("--host", "turn.castlink.ru");
const site = valueOf("--site", "castlink.ru");
const expectedIp = valueOf("--expected-ip", "");
if (![host, site].every(name => name.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(name))) {
  throw new Error("Valid TURN and website DNS hostnames are required");
}

const addresses = await dns.resolve4(host);
console.log(`DNS ${host}: ${addresses.join(", ")}`);
if (expectedIp && !addresses.includes(expectedIp)) throw new Error(`DNS mismatch: expected ${expectedIp}`);
const siteAddresses = await dns.resolve4(site);
console.log(`DNS ${site}: ${siteAddresses.join(", ")}`);
if (expectedIp && !siteAddresses.includes(expectedIp)) throw new Error(`Website DNS mismatch: expected ${expectedIp}`);

async function tlsCheck(servername) {
  await new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: expectedIp || host,
      port: 443,
      servername,
      rejectUnauthorized: true,
      timeout: 8000,
    }, () => {
      const cert = socket.getPeerCertificate();
      console.log(`TLS/443 ${servername}: CN=${cert.subject?.CN || "unknown"}`);
      socket.end();
      resolve();
    });
    socket.once("timeout", () => socket.destroy(new Error(`TLS timeout for ${servername}`)));
    socket.once("error", reject);
  });
}

await tlsCheck(site);
await tlsCheck(host);

await new Promise((resolve, reject) => {
  const req = https.get({
    hostname: expectedIp || site,
    port: 443,
    servername: site,
    headers: { host: site },
    rejectUnauthorized: true,
    timeout: 8000,
  }, res => {
    console.log(`HTTPS ${site}: ${res.statusCode}`);
    res.resume();
    res.on("end", () => res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`Website HTTPS failed: ${res.statusCode}`)));
  });
  req.on("error", reject);
  req.on("timeout", () => req.destroy(new Error("HTTPS timeout")));
});

console.log("PASS: shared TCP/443 serves web TLS and TURN TLS by SNI; TURN allocation and relayed media remain unverified");
