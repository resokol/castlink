#!/bin/sh
# Private source verification only: no publication, installation or lifecycle operation.
set -eu
base=8d11efdfcd4220092b6ac7b8a21af28526da5a6b
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
[ "$(id -u)" -ne 0 ] || { echo 'Run as nonroot to execute the directory-sync permission fault proof' >&2; exit 1; }
case "$(go version)" in 'go version go1.26.0 '*) ;; *) echo 'Go 1.26.0 is required' >&2; exit 1;; esac
scratch=$(mktemp -d /tmp/castlink-private-idleseal-verify.XXXXXX)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
upstream=${1:-https://github.com/livekit/livekit.git}
git clone --no-checkout "$upstream" "$scratch/source"
git -C "$scratch/source" checkout --detach "$base"
[ "$(git -C "$scratch/source" rev-parse HEAD)" = "$base" ]
git -C "$scratch/source" apply --check "$script_dir/livekit-v1.13.7.patch"
git -C "$scratch/source" apply "$script_dir/livekit-v1.13.7.patch"
cd "$scratch/source"
[ -z "$(gofmt -l pkg/idleseal pkg/rtc/private_idle_seal_test.go pkg/rtc/participant.go pkg/rtc/transport.go pkg/rtc/transportmanager.go pkg/service/roommanager.go cmd/server/main.go cmd/server/private_control_test.go cmd/server/private_version_source_test.go)" ]
go test cmd/server/private_version_source_test.go
go test -race ./pkg/idleseal ./pkg/rtc ./cmd/server -run 'TestPrivateIdleSeal|TestPendingBusy|TestObjectOutlives|TestAmbiguousTerminal|TestSealSurvives|TestCorruptState|TestAdmissionSeal|TestControl|TestPrivateConfig|TestPrivateControl|TestUnsealDirectory|TestUnsealFaultRestart|TestCompletedUnsealRestart|TestMissingRetained|TestInitialize|TestRestartNonce|TestEpochCapacity|TestSerializedEpochBudget' -count=1
go build -buildvcs=false -trimpath -o "$scratch/livekit-server-private" ./cmd/server
protocol=$(sed -n 's/^const PrototypeVersion = "\(.*\)"$/\1/p' pkg/idleseal/control.go)
[ -n "$protocol" ]
[ "$("$scratch/livekit-server-private" --version)" = "livekit-server version $protocol" ]
printf '%s\n' 'Pinned patch, focused race tests and private binary build passed. Release remains blocked.'
