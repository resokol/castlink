const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../app/api/move-guest/route.ts"), "utf8");

assert.match(source, /verifiedRoomModeratorSession\(request, room, studioId\)/);
assert.match(source, /isModerator\(request, undefined, studioId\)/);
assert.match(source, /readRooms\(studioId\)/);
assert.match(source, /safe\(studioId \+ "\\|" \+ room \+ "\\|" \+ identity\)/);
assert.doesNotMatch(source, /studioId === defaultStudioId\(\).*verifiedRoomModeratorSession/);

console.log("PASS: guest move commands and moderator authorization remain studio-scoped");
