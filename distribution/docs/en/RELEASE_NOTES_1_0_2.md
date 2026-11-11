# CastLink Server 1.0.2 — release preparation

[Русский](../../RELEASE_NOTES_1_0_2.md) · [English](RELEASE_NOTES_1_0_2.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_2.md)

- Super Admin adds room/connection, CPU, memory, disk and network charts. The rolling 24-hour history persists on disk; background collection every 15 seconds continues with the panel closed and after a restart.
- A structured event, warning and error journal adds severity filters and pagination. Time and size limits apply; heavy event traffic may shorten retention. Passwords and tokens are excluded.
- The new Linux release includes a standalone `install-server.sh` pinned to the exact archive version and SHA256. Choose its exact URL from that release; see [instructions](SERVER_INSTALL.md). Rerunning preserves an existing installation; updating is a separate action.

Update through your server package's normal mechanism using the same data directory, then reload pages off air. Only the platform administrator can access server statistics; room roles do not grant this access. History uses the existing server data directory and requires no additional database service. Windows Client stays at 1.0.0.

Docker-free Windows via WSL2 remains a separate candidate. These notes do not claim a verified Windows release; actual Windows11/WSL and external HTTPS/TURN tests are still required. Published packages and exact checksums remain in the [catalog](PRODUCTS.md).
