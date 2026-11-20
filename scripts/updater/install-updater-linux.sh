#!/bin/sh
# One-time bootstrap from the independent, stable updater release channel.
# Usage: sh install-updater-linux.sh --state-dir /absolute/existing/server [--lang ru|en|zh-CN]
set -eu
command -v python3 >/dev/null 2>&1 || { echo 'Python 3 is required.' >&2; exit 1; }
exec python3 -I -B - "$@" <<'PY'
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
API = 'https://api.github.com/repos/resokol/castlink/releases'
BASE = 'https://github.com/resokol/castlink/releases/download/'
TAG = re.compile(r'updater-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-([a-f0-9]{12})')
class Redirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, url):
        p = urlsplit(url)
        if p.scheme != 'https' or p.hostname not in ('github.com', 'api.github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com') or p.username or p.password or p.port not in (None, 443):
            raise ValueError('Unsafe release redirect')
        return super().redirect_request(req, fp, code, msg, headers, url)
def get(url, limit):
    with build_opener(Redirect()).open(Request(url, headers={'User-Agent':'CastLink-Updater-Installer','Accept':'application/vnd.github+json'}), timeout=20) as response:
        raw = bytearray(); deadline = time.monotonic()+120
        while True:
            block = response.read(min(65536, limit+1-len(raw)))
            if not block: break
            raw.extend(block)
            if len(raw)>limit or time.monotonic()>deadline: raise ValueError('Release response limit exceeded')
        return bytes(raw)
def unique(pairs):
    result = {}
    for k,v in pairs:
        if k in result: raise ValueError('Duplicate JSON key')
        result[k]=v
    return result
def decode(raw): return json.loads(raw, object_pairs_hook=unique)
def stable(r):
    return isinstance(r,dict) and r.get('draft') is False and r.get('prerelease') is False and type(r.get('id')) is int and r['id']>0 and bool(r.get('published_at'))
def identity(r):
    fields=('id','name','state','size','digest','browser_download_url')
    return {**{k:r.get(k) for k in ('id','tag_name','target_commitish','draft','prerelease','published_at')},'assets':sorted([{k:a.get(k) for k in fields} for a in r['assets']],key=lambda a:a['name'])}
def metadata(r,name,limit):
    matches=[a for a in r['assets'] if a.get('name')==name]
    if len(matches)!=1: raise ValueError('Missing or duplicate asset: '+name)
    a=matches[0]
    if a.get('state')!='uploaded' or type(a.get('id')) is not int or a['id']<=0 or type(a.get('size')) is not int or not 0<a['size']<=limit or not re.fullmatch(r'sha256:[a-f0-9]{64}',a.get('digest','')) or a.get('browser_download_url')!=BASE+r['tag_name']+'/'+name:
        raise ValueError('Invalid asset metadata: '+name)
    return a
def download(r,name,limit):
    a=metadata(r,name,limit); raw=get(a['browser_download_url'],limit)
    if len(raw)!=a['size'] or 'sha256:'+hashlib.sha256(raw).hexdigest()!=a['digest']: raise ValueError('Asset integrity failure: '+name)
    return raw
try:
    # This installer only registers existing installations, never applies a product update.
    allowed={'--state-dir','--lang','--install-root','--bin-dir'}
    args=sys.argv[1:]
    if len(args)%2 or any(args[i] not in allowed for i in range(0,len(args),2)) or '--state-dir' not in args:
        raise ValueError('Usage: install-updater-linux.sh --state-dir PATH [--lang ru|en|zh-CN] [--install-root PATH] [--bin-dir PATH]')
    releases=[]
    for page in range(1,11):
        batch=decode(get(API+f'?per_page=100&page={page}',4*1024*1024))
        if not isinstance(batch,list): raise ValueError('Invalid release catalog')
        releases.extend(r for r in batch if stable(r) and TAG.fullmatch(r.get('tag_name','')))
        if len(batch)<100: break
    else: raise ValueError('Release catalog discovery limit exceeded')
    if not releases: raise ValueError('No stable updater release')
    releases.sort(key=lambda r:tuple(map(int,TAG.fullmatch(r['tag_name'])[1].split('.'))),reverse=True)
    release=releases[0]
    if len({r['tag_name'] for r in releases if TAG.fullmatch(r['tag_name'])[1]==TAG.fullmatch(release['tag_name'])[1]})!=1:
        raise ValueError('Ambiguous updater version identity')
    exact=decode(get(API+'/'+str(release['id']),4*1024*1024))
    if not stable(exact) or identity(exact)!=identity(release):
        raise ValueError('Release identity changed')
    raw=download(exact,'manifest.json',1024*1024); manifest=decode(raw); tag=TAG.fullmatch(exact['tag_name'])
    if type(manifest.get('schemaVersion')) is not int or manifest.get('schemaVersion')!=1 or type(manifest.get('protocolVersion')) is not int or manifest.get('protocolVersion')!=1 or manifest.get('channel')!='updater' or manifest.get('repository')!='resokol/castlink' or manifest.get('version')!=tag[1] or manifest.get('releaseTag')!=exact['tag_name'] or not re.fullmatch(r'[a-f0-9]{40}',manifest.get('sourceCommit','')) or manifest['sourceCommit'][:12]!=tag[2] or manifest['sourceCommit']!=exact['target_commitish']:
        raise ValueError('Updater manifest identity or protocol mismatch')
    linux=manifest['platforms']['linux']; files=linux['files']
    if linux['entry']!='castlink-updater.py' or len(files)!=2 or sorted(f['file'] for f in files)!=['castlink-updater.py','linux-compose-setup.py']:
        raise ValueError('Unsafe Linux tool inventory')
    with tempfile.TemporaryDirectory(prefix='castlink-updater-install-') as directory:
        root=Path(directory)
        for f in files:
            a=metadata(exact,f['file'],4*1024*1024)
            if type(f.get('size')) is not int or f['size']!=a['size'] or a['digest']!='sha256:'+f.get('sha256',''): raise ValueError('Manifest digest mismatch')
            data=download(exact,f['file'],4*1024*1024)
            destination=root/f['file']; destination.write_bytes(data); destination.chmod(0o600)
        sys.exit(subprocess.run([sys.executable,'-I','-B',str(root/'castlink-updater.py'),'install',*args],stdin=subprocess.DEVNULL).returncode)
except (ValueError,OSError,KeyError,TypeError) as error:
    print('CastLink: '+str(error),file=sys.stderr); sys.exit(1)
PY
