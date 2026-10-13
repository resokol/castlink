import dns from "node:dns/promises";
import tls from "node:tls";

const args = process.argv.slice(2);
const valueOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const host = valueOf("--host", "turn.castlink.ru");
const expectedIp = valueOf("--expected-ip", "");
const tlsPort = Number(valueOf("--tls-port", "5349"));

if (!host || !Number.isInteger(tlsPort) || tlsPort < 1 || tlsPort > 65535) {
  console.error("Usage: node scripts/turn-preflight.mjs [--host turn.example.com] [--expected-ip x.x.x.x] [--tls-port 5349]");
  process.exit(2);
}

const addresses = await dns.resolve4(host).catch(error => {
  throw new Error(`DNS A lookup failed for ${host}: ${error.message}`);
});
console.log(`DNS ${host}: ${addresses.join(", ")}`);
if (expectedIp && !addresses.includes(expectedIp)) {
  throw new Error(`DNS does not include expected IPv4 ${expectedIp}`);
}

await new Promise((resolve, reject) => {
  const socket = tls.connect({
    host,
    port: tlsPort,
    servername: host,
    rejectUnauthorized: true,
    timeout: 8000,
  }, () => {
    const cert = socket.getPeerCertificate();
    console.log(`TURN/TLS reachable: ${host}:${tlsPort}`);
    console.log(`Certificate subject: ${cert.subject?.CN || "unknown"}`);
    console.log(`Certificate valid to: ${cert.valid_to || "unknown"}`);
    socket.end();
    resolve();
  });
  socket.once("timeout", () => socket.destroy(new Error("TLS connection timed out")));
  socket.once("error", reject);
});

console.log("PASS: DNS and TURN/TLS certificate/connectivity; TURN allocation and relayed media remain unverified");
