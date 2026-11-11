# Windows WSL release: resume plan

The WSL2 architecture and Windows testing are already approved. Continue the
existing server installation/monitoring plan; Linux and Docker Server Setup
1.0.2 assets remain immutable. Root owns code, build and PC operations.

1. Reproduce missing corresponding sources against the actual failed rootfs with
   an offline integration check of installed source identities versus its APT
   indexes. Update remaining Ubuntu base packages using those same indexes;
   run the check before export/source download. Keep exact source/hash checks.
2. Commit clean source, build a new WSL candidate on the Windows producer and
   verify the complete package, corresponding sources and sanitized rootfs.
3. Inspect prerequisites and prepare a concrete real Windows installation. Keep
   existing installations, data, Docker images and unrelated WSL distributions.
   Obtain approval if required for shared networking changes, then verify import,
   services, HTTPS, owner access, history, PPTX, keepalive and stop/restart.
   Distinguish local server proof from external WebRTC/TURN proof.
4. Have GPT-6.1 Sol high independently review the final changes; update verified
   state and RU/EN/ZH instructions. Publish only a complete, verified package
   under a new immutable version/tag within the user's authorized scope.

Evidence/ledger: append checked results here as work proceeds. The source-closure
check consumes the rootfs image built by the producer; export/source packaging
consume that same image and its inventory. No interface change is needed.

Initial evidence: old rootfs apt=2.8.3 is absent from current source indexes;
APT simulation upgrades apt/libapt-pkg6.0t64 to 2.8.4ubuntu0.1 and
libpcre2-8-0 to 10.42-4ubuntu2.2, with no additions/removals/held packages.

Step 1 RED: the new offline integration test ran on the actual failed Windows
producer image `castlink-wsl-build-78327495ead0-rootfs`, exit 1. Of 190 installed
source versions, exactly apt=2.8.3 and pcre2=10.42-4ubuntu2.1 are absent. The
test uses no network, downloads or mock APT responses.
