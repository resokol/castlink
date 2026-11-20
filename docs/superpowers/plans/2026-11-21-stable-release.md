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
- Test the candidate on node2 before GitHub publication, respecting active media sessions and the existing scoped update procedure.
- Synchronize RU/EN/zh-CN documentation and exact per-product links only after verified uploads.
- Preserve Windows Client 1.0.1: desktop/native source is unchanged since its released source 079fd0f9d4b1.
- Do not revive Legacy Windows Docker releases or include unrelated macOS work.

## Tasks

- [x] Verify live /api/version and compare its source to main.
- [ ] Prepare 1.0.7 metadata, multilingual release notes and installation guidance; run relevant tests and CI, review and merge through PR.
- [ ] Run Linux and WSL package workflows from the exact merged source. Check build logs, complete artifacts, manifests and corresponding sources.
- [ ] Exercise the candidate using the supported node2/Windows process; record actual proof and any remaining platform limits.
- [ ] Publish complete verified stable releases, update GitHub description and current product links, and deploy matching site materials.
- [ ] Read back public releases, download hashes, site links and runtime version; record receipts and update working state.
