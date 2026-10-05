# CastLink: self-hosted open-source model

**Status:** Accepted  
**Date:** 2026-10-05

## Decision

CastLink is developed as a fully self-hosted open-source video communication/broadcast platform.

There is no mandatory central CastLink cloud, shared media infrastructure, registration service, control plane, or dependency on infrastructure operated by the CastLink developer.

`castlink.ru` is the creator's private CastLink deployment for the creator's own needs. It is not the public backend of the CastLink product and must not be required for third-party installations.

## Deployment model

A user downloads CastLink and deploys their own independent CastLink Server using Easy Setup.

The installer must offer two primary deployment targets:

1. **Local installation** — install CastLink Server on the current Windows/macOS/Linux computer or a machine in the user's local network.
2. **Remote installation** — install CastLink Server on a user-controlled server/VPS reachable by public IP.

In either model, the resulting instance belongs to and is administered by that user. The user supplies/uses their own server address, IP, networking and, when required, domain/TLS configuration.

Mobile applications for Android/iOS are clients/management applications; a full server role on mobile is not a requirement.

## Easy Setup goal

Installation must not require the user to manually reproduce the current infrastructure deployment procedure.

Easy Setup should automate the already proven CastLink deployment runbook, including where applicable:

- connectivity/preflight checks;
- Docker/runtime installation;
- CastLink services deployment;
- LiveKit configuration;
- database initialization;
- secure secret/key generation;
- reverse proxy and TLS configuration;
- firewall/required port checks;
- service startup;
- final health/connectivity verification.

Existing proven deployment commands and procedures must be reused first. New deployment methods should only be introduced when required for refactoring/optimization or when the existing method cannot satisfy the installer requirements; successful new procedures must then be added to the checked runbook.

## Independence invariant

A third-party CastLink installation MUST continue to operate if:

- `castlink.ru` is unavailable;
- all servers owned by the CastLink creator are offline;
- the third-party installation has no account with the CastLink creator.

No participant media traffic, room control, authentication, licensing check, telemetry, or other runtime-critical operation may require `castlink.ru` unless the user explicitly opts into a future optional service.

A simple architecture test is:

> Shut down castlink.ru and all creator-operated infrastructure. An independently deployed CastLink instance must continue to provide its normal local/self-hosted functionality.

## Product boundary

CastLink itself is software that users can deploy and operate on infrastructure they control.

Each installation has its own:

- administrator;
- rooms and participants;
- media traffic;
- server resources;
- network address;
- configuration and secrets;
- operational responsibility.

The project must avoid evolving into an architecture where independent installations silently depend on a mandatory creator-operated backend.

## Current private deployment

The creator's deployment at `castlink.ru` is one ordinary private CastLink installation. Product architecture must not grant it a special role required by other installations.

## Relationship to the current 1.0 work

The existing CastLink/StudioLink implementation is not discarded. The current LiveKit-based server, web application, deployment configuration, node management and proven deployment procedures are the foundation for the self-hosted distribution.

The next distribution layer is **CastLink Easy Setup / Installer**, built around the existing proven deployment process after the current RC is stabilized.

## Legal/product intent

One motivation for this architecture is to distribute CastLink as independent open-source software rather than operate a centralized public videoconferencing service for third parties.

This document defines the technical/product architecture only. It does not by itself establish the legal classification of CastLink under Russian law; that must be assessed separately against the actual distribution model and functionality.

## Non-goals

The target architecture does **not** require:

- public user registration at castlink.ru;
- a CastLink cloud account;
- mandatory creator-operated media relays/nodes;
- a global creator-operated room directory;
- mandatory central authentication;
- mandatory central licensing;
- routing third-party media through creator-operated servers.

Optional services may be added later only if they do not break the self-hosted independence invariant.
