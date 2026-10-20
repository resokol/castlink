[Русский](../../PRODUCTS.md) · [English](PRODUCTS.md) · [简体中文](../zh-CN/PRODUCTS.md)

# Choose a CastLink package

| Package | Purpose | Latest verified package |
| --- | --- | --- |
| CastLink Client | Windows app for joining an existing server. Participants do not need to install a server. | [Download the Windows client](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Client-1.0.0-rc.3-1472cd052d7e-setup.exe) |
| CastLink Server Setup | Windows wizard for organizers installing a server on a Windows PC or Linux VPS over SSH. | [Download Server Setup](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Windows.zip) |
| CastLink Linux | Standalone Linux server installation without the Windows wizard. | [Download Linux](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Linux.tar.gz) |

These fixed links point to published **1.0.0-rc.3** packages from source commit `1472cd052d7e`. **1.0.0-rc.8** is being prepared; a PR does not mean that new packages have been built or published. [Checksums](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/SHA256SUMS). Verify the relevant file before running it.

Casters can join in a browser without installing an app. Client is for participants; Server Setup installs the organizer's server. [Installation guide](INSTALL.md).

Future releases use separate tags: `client-v…`, `server-setup-v…`, and `linux-v…`. Their versions may differ; updating one package does not update the others. The move to 1.1 is deferred; the current candidate is 1.0.0-rc.8.

A Server Setup release may also include `CastLink-Linux.tar.gz` as the Windows wizard's pinned VPS transport dependency. The wizard uses that asset from its own release and source SHA; it does not substitute the independently released Linux product. Choose `linux-v…` tags for standalone Linux.

When publishing, update each row only to a complete, verified release of that product. Do not use the global `releases/latest` endpoint to determine all three versions.
