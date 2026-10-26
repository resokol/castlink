# CastLink releases

[Русский](../../RELEASE_POLICY.md) · English · [简体中文](../zh-CN/RELEASE_POLICY.md)

- `resokol/castlink` is the single public repository for source under [MIT](../../../LICENSE), packages, checksums and instructions. The old `resokol/castlink-releases` address redirects here; existing manifests retain it for compatibility.
- `main` is the only permanent branch and the build source for all three independent tracks: `client`, `server-setup`, and `linux`. Versions are configured in `release-tracks.json`. Work uses temporary branches and pull requests; delete merged branches only after verifying they contain no unique commits. Pin the verified source SHA before building.
- Each product keeps its own version and tag: `<track>-v<version>-<12-char-sha>`. Releasing one product does not require releasing the others. The generic `releases/latest` is not the source of all product versions; use the [product catalogue](PRODUCTS.md).
- Client uses `windows-desktop-client.yml`; Server Setup and Linux use the selected track in `easy-setup-packages.yml`. Publication defaults to `publish=false` and is enabled manually after verification. The sole publishing destination is `resokol/castlink`.
- Prepare a draft with the complete package, manifest, SHA256SUMS and required third-party materials. Verify contents and hashes before publication. Include required copyleft sources and notices.
- Preserve published tags, filenames, asset bytes, checksums and embedded build/source IDs. Moving a release or correcting documentation is not a rebuild or a server update. Never move published tags or replace archives merely to change documentation.
- Server Setup includes its own pinned `CastLink-Linux.tar.gz` for VPS installation; do not substitute an independent Linux release without verifying the corresponding Server Setup package.
- Release notes explain additions, changes, fixes and update actions. Do not claim unverified functionality or copy private development logs into public notes.
- Maintain Russian, English and Simplified Chinese documentation and language links. Do not translate commands, checksums or identifiers, or replace original licenses and notices with translations.
