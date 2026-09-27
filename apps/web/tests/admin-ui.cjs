const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "../components/RoomControlConsole.tsx"), "utf8");
const invite = fs.readFileSync(path.join(__dirname, "../components/AdminInviteButton.tsx"), "utf8");

assert.match(page, /action:\s*"join"[^}]*mode:\s*"admin"/s, "admin joins in read-only admin mode");
assert.match(page, /role:\s*"studio-moderator"/, "admin receives a moderator token");
assert.match(page, /clientId[^&]*&mode=admin|mode=admin/, "admin polls a read-only snapshot");
assert.match(page, /action:\s*"command"/, "admin commands use the shared control API");
assert.doesNotMatch(page, /getUserMedia|publishTrack|action:\s*"(?:claim|heartbeat|release)"/, "admin never captures or publishes media and never acquires/releases the primary lease");
assert.match(page, /studio-panel-main":\s*\{\s*audio:\s*false/, "main return audio starts muted for the administrator");
assert.match(page, /muted\s+className="return-preview"/, "video element stays muted to avoid a duplicate audio path");
assert.match(page, /identity\.startsWith\("guest-"\)/, "admin guest list excludes studio participants");
assert.doesNotMatch(page, /action:\s*"logout"/, "leaving a room does not revoke authorization in other tabs");
assert.match(page, /await room.disconnect\(\)/, "leaving disconnects this room");
assert.match(page, /replaceState\(null,\s*"",\s*`\$\{url\.pathname\}\$\{url\.search\}`\)/, "invite fragment is removed from the address bar before acceptance");
assert.match(invite, /action:\s*"create"/, "owner can explicitly create an admin invite");
const effectBlocks = invite.match(/useEffect\([\s\S]*?\}, \[roomName\]\);/g) || [];
assert.ok(effectBlocks.length > 0, "owner access check runs when the selected room changes");
assert.ok(effectBlocks.every(block => !/action:\s*"create"/.test(block)), "mounting the invite button never creates an invite");

console.log("Admin UI receive-only and invite safeguards passed");
