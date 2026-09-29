const { spawnSync } = require("node:child_process");
const path = require("node:path");

const tests = [
  "access-secrets.cjs",
  "admin-ui.cjs",
  "app-update.cjs",
  "client-transfer.cjs",
  "control-response.cjs",
  "guest-entry.cjs",
  "guest-invite-revocation.cjs",
  "guest-media.cjs",
  "moderator-room-rename.cjs",
  "monitor-audio.cjs",
  "panel-session.cjs",
  "parallel-studios.cjs",
  "participant-mute-api.cjs",
  "participant-role.cjs",
  "persistent-storage.cjs",
  "remote-studio-devices.cjs",
  "reconnect-recovery.cjs",
  "room-access-version.cjs",
  "room-mode-monitoring.cjs",
  "rotation-api.cjs",
  "saved-servers.cjs",
  "screen-share-lifecycle.cjs",
  "security-url-secrets.cjs",
  "server-transfer-api.cjs",
  "server-transfer.cjs",
  "studio-control-devices.cjs",
  "studio-outbound-stats.cjs",
  "studio-stream-relay.cjs",
  "studio-video-recovery.cjs",
  "studio-viewer-api.cjs",
  "storage-backup-restore.cjs",
  "talkback-policy.cjs",
  "telemetry.cjs",
  "video-quality.cjs",
  "watch-subscriptions.cjs",
  "version-api.cjs"
];

for (const test of tests) {
  process.stdout.write(`\n=== ${test} ===\n`);
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nPASS: ${tests.length} stable CI tests\n`);
