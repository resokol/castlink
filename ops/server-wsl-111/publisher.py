#!/usr/bin/env python3
"""One exact WSL release. Uses this pinned Actions job token; never changes existing tags/assets.

python castlink-wsl-release-1.0.11.py verify|draft|publish packageDir notesFile receiptPath
verify is read-only on GitHub. draft uploads all 27 assets. publish repeats every
check, requires successful full CI, then publishes without changing latest.
Keep receiptPath outside packageDir and reuse it when resuming.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import urllib.parse
import zipfile

REPO = 'resokol/castlink'
SOURCE = os.environ['FACTORY_SHA']
RUN = int(os.environ['FACTORY_RUN'])
VERSION = '1.0.11'
TAG = 'server-wsl-v1.0.11-' + SOURCE[:12]
TITLE = 'CastLink Server Windows / WSL 1.0.11'
ROOTFS = 'CastLink-Server-WSL-amd64.tar.gz'
SOURCES = 'CastLink-Server-WSL-Sources.tar.gz'
UPSTREAM = 'CastLink-ThirdParty-Sources.tar.gz'
MAINTENANCE_ZIP = 'CastLink-Server-WSL-Maintenance.zip'
SUPPORTED = ('server-wsl-v1.0.5-rc.1-085b087a2458',
             'server-wsl-v1.0.5-rc.2-af3e309d0926',
             'server-wsl-v1.0.5-rc.3-95ec46463c82',
             'server-wsl-v1.0.6-rc.1-dad063393b53',
             'server-wsl-v1.0.7-0d16de2e782c','server-wsl-v1.0.8-1afa39b54dd7','server-wsl-v1.0.9-35dbb73b5925','server-wsl-v1.0.10-890a903d51f9')
HELPERS = ('server-wsl-maintenance.ps1', 'server-wsl-maintenance-ui.ps1',
           'server-wsl-maintenance.py', 'server-wsl-runtime.py',
           'install-server-windows.template.ps1')
NATIVE = ('server-native-panel-files.json', 'server-native-control.ps1',
          'server-native-monitor.ps1', 'simple-easy-setup-control.ps1',
          'simple-easy-setup-language.ps1', 'simple-easy-setup-network.ps1',
          'simple-easy-setup-control.ico', 'server-wsl-maintenance.ps1',
          'server-wsl-maintenance-ui.ps1', 'server-native-panel-host.cs',
          'build-server-native-panel-host.ps1', 'castlink-updater.ps1')
ZIP_NAMES = ('manifest.json', 'maintenance-bootstrap.ps1', 'CastLink-Maintenance.cmd', *HELPERS)
NAMES = frozenset((ROOTFS, SOURCES, UPSTREAM, 'packages.tsv', 'manifest.json',
                   'install-server-windows.ps1', 'LICENSE', 'THIRD_PARTY_NOTICES',
                   *NATIVE, *HELPERS, 'maintenance-bootstrap.ps1',
                   'CastLink-Maintenance.cmd', MAINTENANCE_ZIP, 'SHA256SUMS'))


class Refused(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Refused(message)


def digest_file(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def regular_file(file):
    info = file.lstat()
    require(stat.S_ISREG(info.st_mode) and not file.is_symlink()
            and not getattr(file, 'is_junction', lambda: False)()
            and info.st_nlink == 1 and info.st_size > 0,
            'Nonregular, linked or empty package file: ' + file.name)
    return info


def verify_package(folder):
    require(folder.is_dir() and not folder.is_symlink()
            and not getattr(folder, 'is_junction', lambda: False)(), 'Package directory is invalid')
    require({p.name for p in folder.iterdir()} == NAMES and len(NAMES) == 27,
            'Package must contain exactly the expected 27 files')
    assets = []
    for name in sorted(NAMES):
        file = folder/name
        before = regular_file(file)
        digest = digest_file(file)
        after = file.stat()
        require((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns),
                'Package changed while hashing: ' + name)
        assets.append({'name': name, 'size': before.st_size, 'sha256': digest})
    expected = {a['name']: a for a in assets}
    rows = (folder/'SHA256SUMS').read_text(encoding='ascii').splitlines()
    seen = set()
    for row in rows:
        match = re.fullmatch(r'([a-f0-9]{64})  ([A-Za-z0-9._-]+)', row)
        require(match is not None, 'Invalid SHA256SUMS row')
        digest, name = match.groups()
        require(name in NAMES-{'SHA256SUMS'} and name not in seen
                and expected[name]['sha256'] == digest, 'SHA256SUMS mismatch or duplicate: ' + name)
        seen.add(name)
    require(seen == NAMES-{'SHA256SUMS'}, 'SHA256SUMS file set is incomplete')
    require((folder/'manifest.json').stat().st_size <= 1048576, 'Manifest is too large')
    manifest = json.loads((folder/'manifest.json').read_text(encoding='utf-8-sig'))
    for key, value in {'schemaVersion': 1, 'version': VERSION, 'sourceCommit': SOURCE,
                       'releaseTag': TAG, 'channel': 'server-wsl', 'repository': REPO,
                       'architecture': 'amd64'}.items():
        require(manifest.get(key) == value, 'Manifest identity mismatch: ' + key)

    def verify_entry(entry, name):
        a = expected[name]
        require(isinstance(entry, dict) and entry.get('file') == name
                and type(entry.get('size')) is int and entry['size'] == a['size']
                and entry.get('sha256') == a['sha256'], 'Manifest file mismatch: ' + name)

    for key, name in [('rootfs', ROOTFS), ('sources', SOURCES),
                      ('upstreamSources', UPSTREAM), ('inventory', 'packages.tsv')]:
        verify_entry(manifest.get(key), name)
    require(type(manifest['rootfs'].get('expandedBytes')) is int
            and manifest['rootfs']['expandedBytes'] > 0, 'Expanded rootfs inventory is missing')
    lifecycle = manifest.get('lifecycle', {})
    for key, value in {'schemaVersion': 1, 'runtimeContract': 'castlink-wsl-pg16-v1',
                       'postgresMajor': 16, 'supportedSources': list(SUPPORTED),
                       'applicationMigrations': 'runtime-bootstrap-v1'}.items():
        require(lifecycle.get(key) == value, 'Lifecycle contract mismatch: ' + key)
    panel = manifest.get('nativePanel', {})
    require(panel.get('schemaVersion') == 1 and panel.get('host') == 'CastLinkServer.exe'
            and panel.get('binding') == 'server-native-binding.json', 'Native panel contract mismatch')
    for entries, names in [(lifecycle.get('helpers'), HELPERS), (panel.get('files'), NATIVE)]:
        require(isinstance(entries, list) and len(entries) == len(names)
                and all(isinstance(e, dict) for e in entries)
                and {e.get('file') for e in entries} == set(names), 'Helper inventory differs')
        for entry in entries:
            verify_entry(entry, entry['file'])
    with zipfile.ZipFile(folder/MAINTENANCE_ZIP) as archive:
        require(len(archive.infolist()) == len(ZIP_NAMES)
                and set(archive.namelist()) == set(ZIP_NAMES), 'Maintenance ZIP file set differs')
        for item in archive.infolist():
            require(item.file_size == expected[item.filename]['size'], 'Maintenance ZIP size differs')
            h = hashlib.sha256()
            with archive.open(item) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(block)
            require(h.hexdigest() == expected[item.filename]['sha256'], 'Maintenance ZIP bytes differ')
    return assets


class GitHub:
    def __init__(self):
        self.env = dict(os.environ, GH_HOST='github.com', GH_PROMPT_DISABLED='1', GH_PAGER='cat')
        for name in ('GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'):
            self.env.pop(name, None)
        require(os.environ.get('GITHUB_ACTIONS') == 'true'
                and os.environ.get('GITHUB_REPOSITORY') == REPO
                and os.environ.get('GITHUB_REF') == 'refs/heads/ops/server-wsl-111-draft'
                and bool(os.environ.get('GITHUB_TOKEN')), 'Exact publication workflow context required')
        self.env['GH_TOKEN'] = os.environ['GITHUB_TOKEN']

    def api(self, route, method='GET', body=None, binary=None, paginate=False):
        endpoint = route if route.startswith('https://uploads.github.com/') else 'repos/'+REPO+'/'+route
        args = ['gh', 'api', '--hostname', 'github.com', '--method', method, endpoint]
        if paginate:
            args += ['--paginate', '--slurp']
        data = None
        if body is not None:
            args += ['--input', '-', '-H', 'Content-Type: application/json']
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        if binary is not None:
            args += ['--input', str(binary.resolve()), '-H', 'Content-Type: application/octet-stream']
        try:
            result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    env=self.env, timeout=3600 if binary else 60, check=False)
        except (OSError, subprocess.TimeoutExpired):
            raise Refused('GitHub request failed or timed out; reconcile before retry') from None
        require(result.returncode == 0, 'GitHub request failed; response details withheld')
        return json.loads(result.stdout.decode('utf-8-sig'))

    def listing(self, route):
        pages = self.api(route, paginate=True)
        require(isinstance(pages, list) and all(isinstance(p, list) for p in pages), 'Invalid paginated response')
        return [item for page in pages for item in page]


def validate_release(release, notes, draft):
    require(type(release.get('id')) is int and release['id'] > 0
            and release.get('tag_name') == TAG and release.get('target_commitish') == SOURCE
            and release.get('name') == TITLE and release.get('body') == notes
            and release.get('draft') is draft and release.get('prerelease') is False,
            'Release identity, notes or publication state differs')


def validate_assets(actual, expected, complete):
    by_name = {a['name']: a for a in expected}
    require(isinstance(actual, list) and all(isinstance(a, dict) for a in actual), 'Invalid remote assets')
    seen = set()
    for asset in actual:
        name = asset.get('name')
        require(name in by_name and name not in seen, 'Unexpected or duplicate remote asset')
        a = by_name[name]
        require(type(asset.get('id')) is int and asset['id'] > 0 and asset.get('state') == 'uploaded'
                and asset.get('size') == a['size'] and asset.get('digest') == 'sha256:'+a['sha256'],
                'Remote asset state, size or digest differs: ' + name)
        seen.add(name)
    require(not complete or seen == set(by_name), 'Remote release does not contain all 27 assets')


def verify_provenance(gh, require_ci):
    run = gh.api('actions/runs/'+str(RUN))
    require(run.get('id') == RUN and run.get('head_sha') == SOURCE
            and run.get('status') == 'completed' and run.get('conclusion') == 'success'
            and run.get('repository', {}).get('full_name') == REPO
            and run.get('path', '').split('@')[0] == '.github/workflows/server-wsl-package.yml',
            'Exact WSL factory run is not successful')
    require(run['head_branch']=='main' and gh.api('pulls/64')['merge_commit_sha']==SOURCE,'Only the exact merged main source is eligible')
    comparison = gh.api('compare/'+SOURCE+'...main')
    require(comparison.get('status') in ('ahead', 'identical')
            and comparison.get('merge_base_commit', {}).get('sha') == SOURCE,
            'Release source is not an ancestor of main')
    proof = {'factoryRun': RUN, 'factoryUrl': run.get('html_url'), 'mainHead': comparison.get('commits', [{}])[-1].get('sha') if comparison.get('commits') else SOURCE}
    if require_ci:
        pages = gh.api('actions/workflows/ci.yml/runs?head_sha='+SOURCE+'&per_page=100', paginate=True)
        runs = [r for p in pages for r in p.get('workflow_runs', []) if r.get('head_sha') == SOURCE]
        require(bool(runs), 'Full CI has no run for exact release source')
        ci = max(runs, key=lambda r: (r.get('run_number', 0), r.get('run_attempt', 0)))
        require(ci.get('repository', {}).get('full_name') == REPO
                and ci.get('path', '').split('@')[0] == '.github/workflows/ci.yml'
                and ci.get('status') == 'completed' and ci.get('conclusion') == 'success',
                'Latest full CI for exact source is not successful')
        proof['fullCiRun'] = ci['id']
    return proof


def guard_tag(gh, must_exist=False):
    refs = gh.api('git/matching-refs/tags/'+TAG)
    exact = [r for r in refs if r.get('ref') == 'refs/tags/'+TAG]
    require(len(exact) <= 1 and (not must_exist or len(exact) == 1), 'Exact release tag is absent or ambiguous')
    if exact:
        obj = exact[0].get('object', {})
        for _ in range(8):
            if obj.get('type') != 'tag':
                break
            require(re.fullmatch('[a-f0-9]{40}', obj.get('sha', '')) is not None, 'Invalid tag object')
            obj = gh.api('git/tags/'+obj['sha']).get('object', {})
        require(obj.get('type') == 'commit' and obj.get('sha') == SOURCE,
                'Existing release tag points to another commit; no tag movement permitted')


def save_receipt(path, receipt):
    path.parent.mkdir(parents=True, exist_ok=True)
    receipt['updatedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    fd, temp = tempfile.mkstemp(prefix=path.name+'.', suffix='.tmp', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as out:
            json.dump(receipt, out, ensure_ascii=False, indent=2)
            out.write('\n'); out.flush(); os.fsync(out.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def operate(mode, folder, notes_file, receipt_path, gh):
    folder, notes_file, receipt_path = folder.resolve(), notes_file.resolve(), receipt_path.resolve()
    require(receipt_path != folder and folder not in receipt_path.parents, 'Receipt must be outside package directory')
    require(receipt_path != notes_file, 'Receipt must not overwrite release notes')
    require(notes_file.stat().st_size <= 131072, 'Release notes are too large')
    notes = notes_file.read_text(encoding='utf-8-sig').rstrip()
    require(bool(notes) and '\0' not in notes, 'Release notes are empty or invalid')
    expected = verify_package(folder)
    identity = {'schemaVersion': 1, 'repository': REPO, 'sourceCommit': SOURCE,
                'version': VERSION, 'tag': TAG, 'factoryRun': RUN,
                'notesSha256': hashlib.sha256(notes.encode('utf-8')).hexdigest(), 'localAssets': expected}
    receipt = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else dict(identity)
    require(all(receipt.get(k) == v for k, v in identity.items()), 'Existing receipt identity or package differs')
    stage = 'provenance'
    try:
        receipt['provenance'] = verify_provenance(gh, True)
        guard_tag(gh)

        def find_release():
            matches = [r for r in gh.listing('releases?per_page=100') if r.get('tag_name') == TAG]
            require(len(matches) <= 1, 'Multiple releases use exact tag')
            # Drafts may be omitted from collection reads for an installation token.
            # Once creation returned a numeric ID, retain that identity across retries.
            known_id = receipt.get('releaseId')
            if known_id:
                require(type(known_id) is int and known_id > 0, 'Invalid receipt release ID')
                require(not matches or matches[0].get('id') == known_id, 'Exact release selection changed')
                value = gh.api('releases/'+str(known_id))
                require(value.get('id') == known_id and value.get('tag_name') == TAG,
                        'Pinned release identity changed')
                return value
            return matches[0] if matches else None

        release = find_release()
        if release:
            require(not receipt.get('releaseId') or receipt['releaseId'] == release.get('id'), 'Receipt release ID differs')
            validate_release(release, notes, release.get('draft'))
            if release.get('draft') is False:
                require(mode != 'draft', 'Published release is immutable; draft mode refused')
        elif mode != 'verify':
            stage = 'create-draft'
            require(not receipt.get('creationAttempted') and not receipt.get('releaseId'),
                    'Previous create outcome is unresolved; inspect GitHub before any new creation')
            receipt['creationAttempted'] = True
            save_receipt(receipt_path, receipt)  # Durable intent before external POST; never blindly repeat.
            try:
                release = gh.api('releases', method='POST', body={
                    'tag_name': TAG, 'target_commitish': SOURCE, 'name': TITLE, 'body': notes,
                    'draft': True, 'prerelease': False, 'make_latest': 'false', 'generate_release_notes': False})
            except Refused:
                release = find_release()  # A lost POST response may still have created the exact draft.
                require(release is not None, 'Draft creation outcome unresolved; no second POST issued')
            validate_release(release, notes, True)
        if release is None:
            receipt.update(stage='verified-local', mode=mode, published=False)
            save_receipt(receipt_path, receipt)
            return receipt
        release_id = release['id']
        receipt['releaseId'] = release_id
        save_receipt(receipt_path, receipt)

        def fresh_release(draft):
            selected = find_release()
            require(selected is not None and selected.get('id') == release_id, 'Exact release selection changed')
            value = gh.api('releases/'+str(release_id))
            validate_release(value, notes, draft)
            guard_tag(gh, must_exist=not draft)
            return value

        def remote_assets(complete=False):
            values = gh.listing('releases/'+str(release_id)+'/assets?per_page=100')
            validate_assets(values, expected, complete)
            return values

        is_draft = release.get('draft') is True
        fresh_release(is_draft)
        actual = remote_assets(complete=not is_draft)
        if mode == 'draft':
            for asset in expected:
                stage = 'upload-'+asset['name']
                fresh_release(True)
                actual = remote_assets()
                if not any(a['name'] == asset['name'] for a in actual):
                    require(regular_file(folder/asset['name']).st_size == asset['size']
                            and digest_file(folder/asset['name']) == asset['sha256'], 'Local upload bytes changed')
                    route = ('https://uploads.github.com/repos/'+REPO+'/releases/'+str(release_id)
                             +'/assets?name='+urllib.parse.quote(asset['name'], safe=''))
                    try:
                        gh.api(route, method='POST', binary=folder/asset['name'])
                    except Refused:
                        pass  # Read back by numeric release ID, including on failed/lost response.
                    fresh_release(True)
                    actual = remote_assets()
                    require(any(a['name'] == asset['name'] for a in actual), 'Upload not confirmed; rerun safely')
                print('verified asset: '+asset['name'], flush=True)
        stage = 'final-verification'
        require(verify_package(folder) == expected, 'Local package changed during operation')
        fresh_release(is_draft)
        actual = remote_assets(complete=mode != 'verify' or not is_draft)
        if mode == 'publish' and is_draft:
            stage = 'publish'
            receipt['provenance'] = verify_provenance(gh, True)
            fresh_release(True)
            remote_assets(complete=True)
            receipt['stage'] = 'publish-attempted'
            save_receipt(receipt_path, receipt)
            try:
                gh.api('releases/'+str(release_id), method='PATCH', body={
                    'draft': False, 'prerelease': False, 'make_latest': 'false'})
            except Refused:
                pass  # Reconcile publication state; never repeat PATCH blindly.
            release = fresh_release(False)
            actual = remote_assets(complete=True)
            is_draft = False
        receipt.pop('failed', None)
        receipt.update(stage='verified', mode=mode, draft=is_draft, prerelease=False,
                       published=not is_draft, releaseUrl=release.get('html_url'),
                       remoteAssets=[{k:a.get(k) for k in ('id','name','state','size','digest')} for a in actual])
        save_receipt(receipt_path, receipt)
        return receipt
    except Exception:
        receipt.update(stage=stage, failed=True)
        save_receipt(receipt_path, receipt)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('mode', choices=('verify', 'draft', 'publish'))
    parser.add_argument('packageDir', type=Path)
    parser.add_argument('notesFile', type=Path)
    parser.add_argument('receiptPath', type=Path)
    args = parser.parse_args()
    try:
        result = operate(args.mode, args.packageDir, args.notesFile, args.receiptPath, GitHub())
        print(json.dumps({'mode':args.mode, 'stage':result['stage'], 'releaseId':result.get('releaseId'),
                          'published':result.get('published'), 'assets':len(result['localAssets']),
                          'receipt':str(args.receiptPath.resolve())}, ensure_ascii=False))
    except Refused as error:
        print('Release refused: '+str(error), file=sys.stderr)
        return 1
    except Exception as error:
        print('Release failed: '+type(error).__name__+'; inspect local inputs/receipt. No raw API data logged.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
