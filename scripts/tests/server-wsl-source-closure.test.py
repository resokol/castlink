#!/usr/bin/env python3
"""Offline integration check against a real manufacturer-built WSL rootfs."""
import argparse
import subprocess


CHECK = r'''
import json
import subprocess
import sys

installed = {
    tuple(line.split("\t"))
    for line in subprocess.check_output([
        "dpkg-query", "-W", "-f=${source:Package}\t${source:Version}\n"
    ], text=True).splitlines()
}
if not installed or any(len(pair) != 2 or not all(pair) for pair in installed):
    raise SystemExit("Invalid or empty installed source inventory")
names = sorted({name for name, version in installed})
index = subprocess.check_output([
    "apt-cache", "--only-source", "showsrc", *names
], text=True)
available = set()
for paragraph in index.split("\n\n"):
    fields = dict(
        line.split(": ", 1)
        for line in paragraph.splitlines()
        if line.startswith(("Package: ", "Version: "))
    )
    if "Package" in fields and "Version" in fields:
        available.add((fields["Package"], fields["Version"]))
missing = sorted(installed - available)
print(json.dumps({
    "installedSourceVersions": len(installed),
    "missingFromSourceIndexes": [
        {"package": name, "version": version} for name, version in missing
    ],
}, indent=2))
sys.exit(1 if missing else 0)
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    args = parser.parse_args()
    # No update/download: inspect the exact indexes retained by this image.
    result = subprocess.run([
        "docker", "run", "--rm", "--network", "none", "--entrypoint",
        "python3", args.image, "-c", CHECK,
    ], check=False)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
