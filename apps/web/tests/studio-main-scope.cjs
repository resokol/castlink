const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studio/page.tsx"), "utf8");
const picker = fs.readFileSync(path.resolve(__dirname, "../components/StudioRoomPicker.tsx"), "utf8");

assert.match(page, /function StudioContent\(\{ studioId,/);
assert.match(page, /\/api\/rooms\?studioId=/);
assert.match(page, /\/api\/token\?studioId=/);
assert.match(page, /\/api\/studio-control\?studioId=/);
assert.match(page, /JSON\.stringify\(\{ action: "join", studioId,/);
assert.match(page, /JSON\.stringify\(\{ action: "heartbeat", studioId,/);
assert.match(page, /JSON\.stringify\(\{ action: "claim", studioId,/);
assert.match(page, /JSON\.stringify\(\{ studioId, room: roomName, identity/);
assert.match(page, /StudioContent studioId=\{studioId\}/);
assert.match(page, /StudioRoomPicker studioId=\{studioId\}/);
assert.match(page, /\/api\/studio-route\?studioId=/);
assert.match(page, /window\.location\.replace\(destination\.toString\(\)\)/);
assert.match(page, /Переход на назначенный сервер Studio/);
assert.match(page, /\/api\/server-transfer\?studioId=/);
assert.match(page, /JSON\.stringify\(\{ action: "start", studioId, room: roomName, targetId: transferTargetId \}\)/);
assert.doesNotMatch(page, /studioId !== "studio-default"[\s\S]{0,160}setTransferInfo\(\{ targets: \[\], loading: false \}\)/);

assert.match(picker, /studioId = "studio-default"/);
assert.match(picker, /\/api\/rooms\?studioId=/);
assert.match(picker, /JSON\.stringify\(\{ action: "create", studioId,/);
assert.match(picker, /\/studio\?studioId=/);
assert.match(picker, /if \(studioId === "studio-default"\) return;\s*void loadRooms\(\)/);

console.log("PASS: main studio UI preserves studioId across room, token and control operations");
