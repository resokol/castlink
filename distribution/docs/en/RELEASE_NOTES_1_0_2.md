# CastLink Server 1.0.2

[Русский](../../RELEASE_NOTES_1_0_2.md) · [English](RELEASE_NOTES_1_0_2.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_2.md)

- Super Admin adds room/connection, CPU, memory, disk and network charts. The rolling 24-hour history persists on disk; background collection every 15 seconds continues with the panel closed and after a restart.
- A structured event, warning and error journal adds severity filters and pagination. Time and size limits apply; heavy event traffic may shorten retention. Passwords and tokens are excluded.
- The new Linux release includes a standalone `install-server.sh` pinned to the exact archive version and SHA256. Choose its exact URL from that release; see [instructions](SERVER_INSTALL.md). Rerunning preserves an existing installation; updating is a separate action.

Update through your server package's normal mechanism using the same data directory, then reload pages off air. Only the platform administrator can access server statistics; room roles do not grant this access. History uses the existing server data directory and requires no additional database service. Windows Client stays at 1.0.0.

The ordinary local Windows Server Setup 1.0.2 uses Docker Desktop with Linux containers. Docker-free Windows via WSL2 remains a separate candidate without verified Windows11/WSL installation or external media-call/HTTPS/TURN tests. It is not offered as a stable package. [Download server 1.0.2 and SHA256SUMS](PRODUCTS.md).

Server Setup and Linux build: `1.0.2-78327495ead0`; source commit: [`78327495ead06f3d74902cf0c60a7973a0828f2e`](https://github.com/resokol/castlink/tree/78327495ead06f3d74902cf0c60a7973a0828f2e). [Source release](https://github.com/resokol/castlink/releases/tag/source-v1.0.2-78327495ead0) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.2-78327495ead0/SHA256SUMS).
