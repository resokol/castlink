const { spawnSync } = require("node:child_process");
const path = require("node:path");

const tests = [
  "access-secrets.cjs",
  "admin-ui.cjs",
  "app-update.cjs",
  "client-transfer.cjs",
  "control-response.cjs",
  "control-plane-client-remote.cjs",
  "diagnostics-page.cjs",
  "guest-entry.cjs",
  "guest-invite-revocation.cjs",
  "guest-media.cjs",
  "health-api.cjs",
  "licensing.cjs",
  "moderator-room-rename.cjs",
  "moderator-studio-ui.cjs",
  "move-guest-studio-scope.cjs",
  "node-scheduler.cjs",
  "node-heartbeat.cjs",
  "node-control-plane-api.cjs",
  "monitor-audio.cjs",
  "panel-session.cjs",
  "parallel-studios.cjs",
  "participant-mute-api.cjs",
  "participant-role.cjs",
  "persistent-storage.cjs",
  "production-deployment.cjs",
  "room-store-backend.cjs",
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
  "setup-wizard.cjs",
  "server-logging.cjs",
  "server-registry.cjs",
  "studio-access-isolation.cjs",
  "studio-control-devices.cjs",
  "studio-control-plane-api.cjs",
  "studio-main-scope.cjs",
  "studio-owner-access.cjs",
  "studio-auth-isolation.cjs",
  "studio-outbound-stats.cjs",
  "studio-routing.cjs",
  "studio-stream-relay.cjs",
  "studio-video-recovery.cjs",
  "studios-page.cjs",
  "studio-viewer-api.cjs",
  "storage-backup-restore.cjs",
  "talkback-policy.cjs",
  "telemetry.cjs",
  "tenant-scope.cjs",
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
