const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const consoleSource = fs.readFileSync(path.resolve(__dirname, "../components/RoomControlConsole.tsx"), "utf8");
const toolsSource = fs.readFileSync(path.resolve(__dirname, "../components/ModeratorRoomTools.tsx"), "utf8");
const inviteSource = fs.readFileSync(path.resolve(__dirname, "../components/ModeratorInviteButton.tsx"), "utf8");

assert.match(consoleSource, /new URLSearchParams\(\{ studioId, room: roomName, role: "studio-moderator"/);
assert.match(consoleSource, /ModeratorRoomTools roomName=\{roomName\} studioId=\{studioId\}/);
assert.match(toolsSource, /\/api\/rooms\?studioId=/);
assert.match(toolsSource, /JSON\.stringify\(\{ \.\.\.body, studioId \}\)/);
assert.match(toolsSource, /\/moderator\?studioId=/);
assert.doesNotMatch(inviteSource, /studioId !== "studio-default"/);
assert.match(inviteSource, /scope === "room" \? "room" : "studio"/);

console.log("PASS: moderator UI preserves studioId through refresh, room tools and invite flow");
