# CastLink 1.0.7 stable release plan

> Execute the authorized release in this chat; use verification-before-completion for each published result.

**Goal:** Release the behavior approved on castlink.ru through the supported server installers, GitHub and site documentation.

**Architecture:** Preserve the application tree deployed as ed79f1df2602a16c518b7d64bc04f8680aff9e36. Build new immutable Linux and WSL packages as 1.0.7; retain the unchanged stable Windows Client 1.0.1 and Legacy Docker packages.

**Tech stack:** Node/pnpm, GitHub Actions, Ubuntu/Docker packaging, Windows/WSL2, existing hosted-site deployment.

**Spec:** Owner request of 21 November 2026: current castlink.ru is the accepted baseline; publish stable updates and synchronize patch notes, user instructions and GitHub description.

## Constraints and checks

- Preserve deployed application behavior, user data, secrets and existing release assets.
- Never relabel an old RC archive as a newly tested stable package.
- Verify exact source, asset inventory and SHA256 before publication; keep incomplete packages in draft.
- Owner clarified that they will update node2 themselves. Verify packages without updating or requiring access to node2.
- Synchronize RU/EN/zh-CN documentation and exact per-product links only after verified uploads.
- Preserve Windows Client 1.0.1: desktop/native source is unchanged since its released source 079fd0f9d4b1.
- Do not revive Legacy Windows Docker releases or include unrelated macOS work.

## Tasks

- [x] Verify live /api/version and compare its source to main.
- [x] Prepare 1.0.7 metadata, multilingual release notes and installation guidance; run relevant tests and CI, review and merge through PR.
- [x] Run Linux and WSL package workflows from exact source commits included in main. Check build logs, complete artifacts, manifests and corresponding sources.
- [x] Verify exact package payloads and supported Windows boundaries; record actual proof and any remaining platform limits. Node2 update is reserved to the owner.
- [x] Publish complete verified stable releases, update GitHub description and current product links, and deploy matching site materials.
- [x] Read back public releases, download hashes, site links and runtime version; record receipts and update working state.

## Publication evidence

- Release preparation merged in PR #48 as `ac9c234c72b02ea594c2363d36611b1d732502d8`; its tree equals WSL source `0d16de2e782cd2e847e9824024c5b788a080a59b`.
- Exact source CI `44820421140` and merged main CI `44822183730`: success. Local stable CI: 371 passing checks; web TypeScript passed.
- WSL factory `44820441013`: success, including native Windows checks. Full artifact `14672099063`: SHA256 `848aae49ee00c1b035a0eeeece3125e3d9d82576f35547dee7ae3c4c7006fe57`.
- WSL publication `44825337108`: success. Release `453219791`, `server-wsl-v1.0.7-0d16de2e782c`, stable with 26 verified assets. Publication receipt artifact `14673328314`.
- Linux build/publication `44822224079`: success. Release `453209137`, `linux-v1.0.7-ac9c234c72b0`, stable with 7 verified assets, GitHub Latest.
- Public release manifests and SHA256SUMS downloaded and checked against exact source/tag and every GitHub asset digest before site publication.
- General site: three changed static files; account downloads: two changed files. Exact preconditions, private backups and rollback verified (14 site and 3 account transaction fixtures). Public HTTPS bytes match prepared files; account logic and Client links unchanged, no service restarts.
- Current guides and exact product download links synchronized in PR #50. Current-channel checks (5), Linux guide tests (3), translated links and RU README mirror pass; generated manual catalog checked after final state update.
- Owner updates node2 independently. No new physical Windows reboot or live OBS/vMix acceptance test is claimed. The accepted production runtime remains `1.0.6-ed79f1df2602`.
