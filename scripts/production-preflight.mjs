import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] || "infrastructure/production");
const webEnvPath = path.join(root, "web.env");
const postgresEnvPath = path.join(root, "postgres.env");
const composePath = path.join(root, "docker-compose.yml");

function parseEnv(text) {
  const result = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

function requireValue(env, name) {
  const value = env[name]?.trim();
  if (!value || value === "CHANGE_ME") throw new Error(`${name} is missing or still uses placeholder`);
  return value;
}

await access(composePath);
const [webText, postgresText] = await Promise.all([
  readFile(webEnvPath, "utf8"),
  readFile(postgresEnvPath, "utf8"),
]);
const web = parseEnv(webText);
const postgres = parseEnv(postgresText);

const installationId = requireValue(web, "STUDIOLINK_INSTALLATION_ID");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installationId)) {
  throw new Error("STUDIOLINK_INSTALLATION_ID must be a UUID");
}

for (const name of [
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "STUDIOLINK_STUDIO_PASSWORD_HASH",
  "CASTLINK_SESSION_SECRET",
  "CASTLINK_DATA_ENCRYPTION_KEY",
  "CASTLINK_SETUP_TOKEN",
]) requireValue(web, name);

requireValue(postgres, "POSTGRES_USER");
requireValue(postgres, "POSTGRES_DB");
const postgresPassword = requireValue(postgres, "POSTGRES_PASSWORD");

const databaseUrl = requireValue(web, "DATABASE_URL");
if (!databaseUrl.startsWith("postgresql://")) throw new Error("DATABASE_URL must use postgresql://");
if (databaseUrl.includes("CHANGE_ME")) throw new Error("DATABASE_URL still contains placeholder credentials");
if (!databaseUrl.includes(encodeURIComponent(postgresPassword)) && !databaseUrl.includes(`:${postgresPassword}@`)) {
  throw new Error("DATABASE_URL password does not match postgres.env");
}

const backend = (web.CASTLINK_STORAGE_BACKEND || "json").toLowerCase();
if (!["json", "postgres"].includes(backend)) throw new Error("CASTLINK_STORAGE_BACKEND must be json or postgres");

const image = process.env.CASTLINK_WEB_IMAGE?.trim();
if (!image) throw new Error("CASTLINK_WEB_IMAGE must be set to the release image");
if (/:latest(?:$|@)/.test(image)) throw new Error("CASTLINK_WEB_IMAGE must not use latest");
if (!image.includes(":") && !image.includes("@sha256:")) throw new Error("CASTLINK_WEB_IMAGE must be pinned by tag or digest");

console.log(JSON.stringify({
  ok: true,
  compose: composePath,
  storageBackend: backend,
  installationId,
  image,
  secrets: "validated but not printed",
}));
