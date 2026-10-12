"""Inspect every distributed image layer, including files hidden by whiteouts.

Uses only Python 3.8+ standard libraries, streams layers without extracting them,
and reports paths only. Environment/private file contents are never inspected.
"""
import argparse
import collections
import json
import pathlib
import re
import sys
import tarfile


def refused_path(name):
    name = name.replace('\\', '/').lstrip('/')
    while name.startswith('./'):
        name = name[2:]
    parts = name.split('/')
    vendor = 'node_modules' in parts
    legal_notice = 'third_party' in parts and re.match(r'^(?:licen[sc]e|copying|notice|copyright)(?:[._-].*)?$', parts[-1], re.I)
    if any(part in ('.git', '.aws', '.codex', '.agents', '.studiolink-data') for part in parts):
        return 'private directory'
    if any(part.startswith('.env') or part.endswith('.env') or '.env.' in part for part in parts):
        return 'environment file'
    if not vendor and name.endswith(('.ts', '.tsx', '.map')):
        return 'original application source or map'
    if not vendor and not legal_notice and re.search(r'(?:^|/)(?:apps/web/)?(?:docs|tests)(?:/|$)', name):
        return 'project documentation or tests'
    if not vendor and re.match(r'(?:app/)?apps/web/(?:app|components|lib)(?:/|$)', name):
        return 'original application directory'
    if '..' in parts:
        return 'archive path traversal'
    return None


def audit_image(archive_path):
    with tarfile.open(archive_path, 'r:gz') as archive:
        manifest = json.load(archive.extractfile('manifest.json'))
    expected = {layer for image in manifest for layer in image.get('Layers', [])}
    seen = set()
    counts = collections.Counter()
    findings = []
    with tarfile.open(archive_path, 'r|gz') as archive:
        for entry in archive:
            if entry.name not in expected:
                continue
            if not entry.isfile():
                raise ValueError('Layer is not a regular archive member')
            seen.add(entry.name)
            with tarfile.open(fileobj=archive.extractfile(entry), mode='r|*') as layer:
                for file in layer:
                    # Whiteouts do not erase evidence from an earlier layer.
                    if not (file.isfile() or file.issym() or file.islnk()):
                        continue
                    name = file.name
                    reason = refused_path(name)
                    if reason:
                        findings.append({'layer': entry.name, 'path': name, 'reason': reason})
                    elif 'node_modules' in name.replace('\\', '/').split('/') and name.endswith(('.ts', '.tsx', '.map')):
                        counts['vendorSources'] += 1
                    counts['files'] += 1
    if expected != seen:
        raise ValueError('Image manifest references missing layers')
    result = {'schemaVersion': 1, 'passed': not findings, 'images': len(manifest), 'layers': len(seen), 'files': counts['files'], 'vendorSources': counts['vendorSources'], 'findings': findings}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', required=True, type=pathlib.Path)
    parser.add_argument('--report', type=pathlib.Path)
    args = parser.parse_args()
    try:
        result = audit_image(args.image)
        if args.report:
            args.report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
        if not result['passed']:
            print('Refused artifact: original source or private files exist in distributed layers', file=sys.stderr)
            print(json.dumps(result), file=sys.stderr)
            sys.exit(1)
        print(json.dumps(result))
    except (OSError, ValueError, KeyError, tarfile.TarError) as error:
        print('Refused artifact: image archive could not be fully inspected (' + type(error).__name__ + ')', file=sys.stderr)
        sys.exit(1)
