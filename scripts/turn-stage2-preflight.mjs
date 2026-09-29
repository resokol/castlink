import dns from "node:dns/promises";
import tls from "node:tls";
import https from "node:https";

const host = "turn.castlink.ru";
const site = "castlink.ru";
const expectedIp = process.argv.includes("--expected-ip")
  ? process.argv[process.argv.indexOf("--expected-ip") + 1]
  : "";

const addresses = await dns.resolve4(host);
console.log(`DNS ${host}: ${addresses.join(", ")}`);
if (expectedIp && !addresses.includes(expectedIp)) throw new Error(`DNS mismatch: expected ${expectedIp}`);

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
    res.on("end", resolve);
  });
  req.on("error", reject);
  req.on("timeout", () => req.destroy(new Error("HTTPS timeout")));
});

console.log("PASS: shared TCP/443 serves web TLS and TURN TLS by SNI");
